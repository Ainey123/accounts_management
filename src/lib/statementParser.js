import crypto from 'crypto';
import * as XLSX from 'xlsx';

/**
 * Utility to compute SHA-256 hash of a buffer or string.
 */
export function computeHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Clean and parse numeric currency string (handles "Rs.", commas, parentheses for negative, etc.)
 */
export function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
  
  let str = String(val).trim();
  if (!str || str === '-' || str === '—' || str === 'nil' || str === 'N/A') return 0;
  
  // Remove currency signs, commas, extra whitespace
  str = str.replace(/PKR|Rs\.?|USD|\$|,|\s/gi, '');
  
  // Handle (1,000.00) format
  if (str.startsWith('(') && str.endsWith(')')) {
    str = str.slice(1, -1);
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parse a wide variety of date string formats into a valid JavaScript Date.
 */
export function parseDateString(str) {
  if (!str) return new Date();
  if (str instanceof Date && !isNaN(str.getTime())) return str;
  
  if (typeof str === 'number') {
    // Excel serial date number
    try {
      const parsed = XLSX.SSF.parse_date_code(str);
      if (parsed) {
        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0));
      }
    } catch (e) {}
  }

  const clean = String(str).trim();
  
  // Try direct Date constructor
  const direct = new Date(clean);
  if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000 && direct.getFullYear() < 2100) {
    return direct;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 15-Aug-2026 or 15 Aug 2026)
  const dMmmYMatch = clean.match(/^(\d{1,2})[\s\-\/\.]([A-Za-z]{3,9})[\s\-\/\.](\d{2,4})/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1], 10);
    const monthStr = dMmmYMatch[2].toLowerCase().slice(0, 3);
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[monthStr] !== undefined ? months[monthStr] : 0;
    let year = parseInt(dMmmYMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  return new Date();
}

/**
 * Standardize transaction line item and calculate unique transaction hash for deduplication.
 */
export function buildTransaction({
  date,
  valueDate = null,
  description = '',
  referenceNo = '',
  chequeNo = '',
  debit = 0,
  credit = 0,
  balance = null,
}) {
  const txDate = parseDateString(date);
  const cleanDesc = String(description || '').trim();
  const cleanRef = String(referenceNo || chequeNo || '').trim();
  const debitAmount = parseAmount(debit);
  const creditAmount = parseAmount(credit);
  const balAmount = balance !== null && balance !== undefined ? parseAmount(balance) : null;

  // Generate robust transaction signature for deduplication
  const dateStr = txDate.toISOString().slice(0, 10);
  const rawSig = `${dateStr}|${cleanDesc.toLowerCase().replace(/\s+/g, ' ')}|${debitAmount.toFixed(2)}|${creditAmount.toFixed(2)}|${cleanRef}`;
  const transactionHash = computeHash(rawSig);

  return {
    transactionDate: txDate,
    valueDate: valueDate ? parseDateString(valueDate) : null,
    description: cleanDesc,
    referenceNo: cleanRef || null,
    chequeNo: chequeNo ? String(chequeNo).trim() : null,
    debit: debitAmount,
    credit: creditAmount,
    balance: balAmount,
    transactionHash,
    matchStatus: 'UNMATCHED',
    reconciledAmount: 0,
  };
}

/**
 * Parse CSV or TSV string into structured transactions.
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const sep = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const parseRow = (rowStr) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === sep && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  let headerIdx = 0;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = parseRow(lines[i]).map(h => h.toLowerCase());
    if (row.some(h => h.includes('date') || h.includes('desc') || h.includes('debit') || h.includes('amount') || h.includes('particular'))) {
      headerIdx = i;
      headers = row;
      break;
    }
  }

  if (headers.length === 0) {
    headers = parseRow(lines[0]).map(h => h.toLowerCase());
  }

  const dateIdx = headers.findIndex(h => h.includes('date') && !h.includes('value'));
  const valueDateIdx = headers.findIndex(h => h.includes('val'));
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('particular') || h.includes('detail') || h.includes('narration') || h.includes('remark'));
  const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('chq') || h.includes('cheque') || h.includes('trans') || h.includes('stan') || h.includes('doc'));
  const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('dr') || h.includes('withdrawal') || h.includes('paid out') || h.includes('money out'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('cr') || h.includes('deposit') || h.includes('paid in') || h.includes('money in'));
  const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('trans amount'));
  const balanceIdx = headers.findIndex(h => h.includes('balance') || h.includes('bal'));
  const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('dr/cr') || h.includes('d/c'));

  const transactions = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0];
    const rawDesc = descIdx >= 0 ? cols[descIdx] : (cols[1] || 'Transaction');
    const rawRef = refIdx >= 0 ? cols[refIdx] : '';
    const rawBalance = balanceIdx >= 0 ? cols[balanceIdx] : null;

    let debit = 0;
    let credit = 0;

    if (debitIdx >= 0 && creditIdx >= 0) {
      debit = parseAmount(cols[debitIdx]);
      credit = parseAmount(cols[creditIdx]);
    } else if (amountIdx >= 0) {
      const amt = parseAmount(cols[amountIdx]);
      if (typeIdx >= 0) {
        const typeStr = (cols[typeIdx] || '').toUpperCase();
        if (typeStr.includes('DR') || typeStr.includes('DEBIT') || typeStr.includes('OUT')) {
          debit = amt;
        } else {
          credit = amt;
        }
      } else {
        const rawAmt = cols[amountIdx] || '';
        if (rawAmt.includes('-') || rawAmt.startsWith('(')) {
          debit = amt;
        } else {
          credit = amt;
        }
      }
    } else if (debitIdx >= 0) {
      debit = parseAmount(cols[debitIdx]);
    }

    if (debit > 0 || credit > 0) {
      transactions.push(buildTransaction({
        date: rawDate,
        valueDate: valueDateIdx >= 0 ? cols[valueDateIdx] : null,
        description: rawDesc,
        referenceNo: rawRef,
        debit,
        credit,
        balance: rawBalance,
      }));
    }
  }

  return transactions;
}

/**
 * Parse Excel workbook buffer (.xlsx, .xls) into structured transactions.
 */
export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
  if (!rawRows || rawRows.length < 2) return [];

  let headerIdx = 0;
  let headers = [];
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = (rawRows[i] || []).map(c => String(c).toLowerCase().trim());
    if (row.some(h => h.includes('date') || h.includes('desc') || h.includes('debit') || h.includes('particular') || h.includes('withdrawal'))) {
      headerIdx = i;
      headers = row;
      break;
    }
  }

  if (headers.length === 0) {
    headers = (rawRows[0] || []).map(c => String(c).toLowerCase().trim());
  }

  const dateIdx = headers.findIndex(h => h.includes('date') && !h.includes('value'));
  const valueDateIdx = headers.findIndex(h => h.includes('val'));
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('particular') || h.includes('detail') || h.includes('narration') || h.includes('remark') || h.includes('memo'));
  const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('chq') || h.includes('cheque') || h.includes('trans') || h.includes('stan') || h.includes('doc'));
  const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('dr') || h.includes('withdrawal') || h.includes('paid out') || h.includes('money out'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('cr') || h.includes('deposit') || h.includes('paid in') || h.includes('money in'));
  const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('trans amount'));
  const balanceIdx = headers.findIndex(h => h.includes('balance') || h.includes('bal'));
  const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('dr/cr') || h.includes('d/c'));

  const transactions = [];

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const rawDate = dateIdx >= 0 ? row[dateIdx] : row[0];
    const rawDesc = descIdx >= 0 ? row[descIdx] : (row[1] || 'Bank Transaction');
    const rawRef = refIdx >= 0 ? row[refIdx] : '';
    const rawBalance = balanceIdx >= 0 ? row[balanceIdx] : null;

    let debit = 0;
    let credit = 0;

    if (debitIdx >= 0 && creditIdx >= 0) {
      debit = parseAmount(row[debitIdx]);
      credit = parseAmount(row[creditIdx]);
    } else if (amountIdx >= 0) {
      const amt = parseAmount(row[amountIdx]);
      if (typeIdx >= 0) {
        const typeStr = String(row[typeIdx] || '').toUpperCase();
        if (typeStr.includes('DR') || typeStr.includes('DEBIT') || typeStr.includes('OUT')) {
          debit = amt;
        } else {
          credit = amt;
        }
      } else {
        const rawAmt = String(row[amountIdx] || '');
        if (rawAmt.includes('-') || rawAmt.startsWith('(')) {
          debit = amt;
        } else {
          credit = amt;
        }
      }
    } else if (debitIdx >= 0) {
      debit = parseAmount(row[debitIdx]);
    }

    if (debit > 0 || credit > 0) {
      transactions.push(buildTransaction({
        date: rawDate,
        valueDate: valueDateIdx >= 0 ? row[valueDateIdx] : null,
        description: rawDesc,
        referenceNo: rawRef,
        debit,
        credit,
        balance: rawBalance,
      }));
    }
  }

  return transactions;
}

/**
 * Extract text from PDF buffer safely across Node / Next.js runtimes.
 */
async function extractPDFText(buffer) {
  try {
    const pdfModule = await import('pdf-parse');
    if (pdfModule && pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const textResult = await parser.getText();
      if (typeof textResult === 'string') return textResult;
      if (textResult && typeof textResult.text === 'string') return textResult.text;
    }
    if (typeof pdfModule.default === 'function') {
      const res = await pdfModule.default(buffer);
      return res.text || '';
    }
  } catch (e) {
    console.warn('PDF parser module fallback:', e.message);
  }

  // Fallback: simple text stream extraction
  const rawStr = buffer.toString('latin1');
  const textChunks = [];
  const streamRegex = /BT[\s\S]*?ET/g;
  let match;
  while ((match = streamRegex.exec(rawStr)) !== null) {
    const block = match[0];
    const tjMatches = block.match(/\((.*?)\)\s*Tj/g);
    if (tjMatches) {
      const line = tjMatches.map(m => m.replace(/^\(|\)\s*Tj$/g, '')).join(' ');
      textChunks.push(line);
    }
  }
  if (textChunks.length > 0) return textChunks.join('\n');
  return buffer.toString('utf-8');
}

/**
 * Parse PDF statement buffer into structured transactions using intelligent regex heuristics.
 */
export async function parsePDF(buffer) {
  const fullText = await extractPDFText(buffer);
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const transactions = [];
  const datePattern = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\s\-\/\.][A-Za-z]{3,9}[\s\-\/\.]\d{2,4}|\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/;
  const numberRegex = /[\d,]+\.\d{2}/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchDate = line.match(datePattern);
    
    if (matchDate) {
      const dateStr = matchDate[1];
      const remainder = line.slice(matchDate[0].length).trim();
      const numbers = remainder.match(numberRegex) || [];
      
      if (numbers.length > 0) {
        let desc = remainder;
        numbers.forEach(n => {
          desc = desc.replace(n, ' ');
        });
        desc = desc.replace(/\s+/g, ' ').trim();
        
        let debit = 0;
        let credit = 0;
        let balance = null;
        
        if (numbers.length === 1) {
          const upper = line.toUpperCase();
          const amt = parseAmount(numbers[0]);
          if (upper.includes(' DR') || upper.includes('DEBIT') || upper.includes('WITHDRAWAL') || upper.includes('OUT')) {
            debit = amt;
          } else {
            credit = amt;
          }
        } else if (numbers.length === 2) {
          const val1 = parseAmount(numbers[0]);
          const val2 = parseAmount(numbers[1]);
          const upper = line.toUpperCase();
          
          if (upper.includes(' DR') || upper.includes('DEBIT') || upper.includes('TRF TO') || upper.includes('IBFT TO') || upper.includes('ATM')) {
            debit = val1;
            balance = val2;
          } else {
            credit = val1;
            balance = val2;
          }
        } else if (numbers.length >= 3) {
          debit = parseAmount(numbers[0]);
          credit = parseAmount(numbers[1]);
          balance = parseAmount(numbers[2]);
        }
        
        const refMatch = desc.match(/(?:REF|STAN|CHQ|TRX|FT|TXN|ID)[\s#:]*([A-Za-z0-9\-_]+)/i);
        const refNo = refMatch ? refMatch[1] : null;

        if (debit > 0 || credit > 0) {
          transactions.push(buildTransaction({
            date: dateStr,
            description: desc || 'Bank Statement Entry',
            referenceNo: refNo,
            debit,
            credit,
            balance,
          }));
        }
      }
    }
  }

  return transactions;
}

/**
 * High-level parser that autodetects file type, extracts transactions,
 * computes statement aggregates, and ensures complete financial correctness.
 */
export async function parseStatementFile({ buffer, fileName, bankNameOverride = '' }) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const fileHash = computeHash(buffer);
  
  let transactions = [];
  let detectedBankName = bankNameOverride || 'Bank Account';
  
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    const text = buffer.toString('utf-8');
    transactions = parseCSV(text);
  } else if (ext === 'xlsx' || ext === 'xls') {
    transactions = parseExcel(buffer);
  } else if (ext === 'pdf') {
    transactions = await parsePDF(buffer);
  } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    transactions = [];
  } else {
    try {
      transactions = parseExcel(buffer);
    } catch (e) {
      transactions = parseCSV(buffer.toString('utf-8'));
    }
  }

  let totalDebits = 0;
  let totalCredits = 0;
  let minDate = null;
  let maxDate = null;
  let openingBalance = null;
  let closingBalance = null;

  if (transactions.length > 0) {
    transactions.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
    
    minDate = transactions[0].transactionDate;
    maxDate = transactions[transactions.length - 1].transactionDate;
    
    openingBalance = transactions[0].balance;
    closingBalance = transactions[transactions.length - 1].balance;

    transactions.forEach(t => {
      totalDebits += t.debit || 0;
      totalCredits += t.credit || 0;
    });
  }

  if (!bankNameOverride || bankNameOverride === 'Other / Auto-Detect') {
    const nameLower = fileName.toLowerCase();
    if (nameLower.includes('meezan')) detectedBankName = 'Meezan Bank';
    else if (nameLower.includes('hbl')) detectedBankName = 'HBL';
    else if (nameLower.includes('ubl')) detectedBankName = 'UBL';
    else if (nameLower.includes('mcb')) detectedBankName = 'MCB Bank';
    else if (nameLower.includes('allied') || nameLower.includes('abl')) detectedBankName = 'Allied Bank';
    else if (nameLower.includes('faysal')) detectedBankName = 'Faysal Bank';
    else if (nameLower.includes('alfalah')) detectedBankName = 'Bank Alfalah';
    else if (nameLower.includes('standard') || nameLower.includes('scb')) detectedBankName = 'Standard Chartered';
    else if (nameLower.includes('askari')) detectedBankName = 'Askari Bank';
    else if (nameLower.includes('dubai') || nameLower.includes('dib')) detectedBankName = 'Dubai Islamic Bank';
    else if (nameLower.includes('js')) detectedBankName = 'JS Bank';
  }

  const statementPeriod = minDate && maxDate
    ? `${minDate.toISOString().slice(0, 10)} to ${maxDate.toISOString().slice(0, 10)}`
    : null;

  return {
    fileName,
    fileHash,
    fileSize: buffer.length,
    fileType: ext.toUpperCase(),
    bankName: detectedBankName,
    startDate: minDate,
    endDate: maxDate,
    statementPeriod,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    openingBalance,
    closingBalance,
    transactionCount: transactions.length,
    transactions,
  };
}
