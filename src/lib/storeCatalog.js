/**
 * GROUND FLOOR COMPANY STORE INVENTORY CATALOG
 * Classified into 3 Material Pillars:
 * 1. FIXED MATERIAL (Company Store & Workshop Capital Assets)
 * 2. CONSUMABLE MATERIAL (Site Installed / Consumed permanently)
 * 3. RETURNABLE MATERIAL (Field Tools, Cylinders, Testing Kits issued & returned)
 */

export const MATERIAL_TYPES = {
  FIXED: 'Fixed Material',
  CONSUMABLE: 'Consumable Material',
  RETURNABLE: 'Returnable Material',
};

export const SOURCING_MODES = {
  STORE: 'Buy from Store',
  SELF_BUY: 'Self Buy',
};

export const GROUND_FLOOR_STORE_CATALOG = [
  // ─── 1. FIXED MATERIAL (Store / Office / Workshop Permanent Assets) ───
  { id: 'FIX-001', name: 'Welding Plant', category: 'Tools & Machinery', type: MATERIAL_TYPES.FIXED, stock: '2 Pic', unit: 'Pic', location: 'Ground Floor Tool Rack A', minStock: 1, desc: 'Heavy Arc Welding Set' },
  { id: 'FIX-002', name: 'Drill Machine', category: 'Tools & Machinery', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Tool Rack A', minStock: 1, desc: 'Electric Impact Drill' },
  { id: 'FIX-003', name: 'Padistal Drill Machine', category: 'Tools & Machinery', type: MATERIAL_TYPES.FIXED, stock: '4 Pic', unit: 'Pic', location: 'Workshop Bench', minStock: 1, desc: 'Bench Drill Stand & Motor' },
  { id: 'FIX-004', name: 'Blower Machine', category: 'Tools & Machinery', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Tool Rack B', minStock: 1, desc: 'Air Blower for panel cleaning' },
  { id: 'FIX-005', name: 'Heat Gun', category: 'Tools & Machinery', type: MATERIAL_TYPES.FIXED, stock: '2 Pic', unit: 'Pic', location: 'Electrical Drawer', minStock: 1, desc: 'Heat Gun for shrink sleeve' },
  { id: 'FIX-006', name: 'Invertor', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Store Power Corner', minStock: 1, desc: 'Solar / Backup Inverter' },
  { id: 'FIX-007', name: '1.5 HP Motor', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Heavy Motor Bay', minStock: 0, desc: 'Single Phase Induction Motor' },
  { id: 'FIX-008', name: '0.33 HP Motor', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Heavy Motor Bay', minStock: 0, desc: 'Small Utility Motor' },
  { id: 'FIX-009', name: 'Vacum Cleaner', category: 'Office & Facility', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Ground Storage', minStock: 1, desc: 'Industrial Vacuum' },
  { id: 'FIX-010', name: 'Computer LCD / 32 Inch LCD', category: 'Office & Facility', type: MATERIAL_TYPES.FIXED, stock: '2 Pic', unit: 'Pic', location: 'IT Shelf', minStock: 1, desc: 'Display Monitors' },
  { id: 'FIX-011', name: 'Ceiling Fan', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '2 Pic', unit: 'Pic', location: 'Appliance Section', minStock: 1, desc: '56 inch Ceiling Fan' },
  { id: 'FIX-012', name: 'Exaust Fan 10x10 / 8x8', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '3 Pic', unit: 'Pic', location: 'Appliance Section', minStock: 1, desc: 'Heavy Exhaust Fan' },
  { id: 'FIX-013', name: 'Heater', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Storage Bay', minStock: 1, desc: 'Electric Room Heater' },
  { id: 'FIX-014', name: 'Padistal Fan', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'Appliance Section', minStock: 1, desc: 'Standing Fan' },
  { id: 'FIX-015', name: 'Solar Pump', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '4 Pic', unit: 'Pic', location: 'Heavy Motor Bay', minStock: 1, desc: 'Submersible Solar Pump' },
  { id: 'FIX-016', name: 'Glass Door Machine', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.FIXED, stock: '3 Pic', unit: 'Pic', location: 'Hardware Bin 1', minStock: 1, desc: 'Floor Spring Glass Machine' },
  { id: 'FIX-017', name: 'LCD Genarator', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '1 Pic', unit: 'Pic', location: 'IT Shelf', minStock: 1, desc: 'Generator Control Panel Display' },
  { id: 'FIX-018', name: 'Panasonic Phone / Phone Set', category: 'Office & Facility', type: MATERIAL_TYPES.FIXED, stock: '2 Pic', unit: 'Pic', location: 'Office Storage', minStock: 1, desc: 'Office Landline Telephone Sets' },
  { id: 'FIX-019', name: 'Insect Killer / Iron', category: 'Office & Facility', type: MATERIAL_TYPES.FIXED, stock: '3 Pic', unit: 'Pic', location: 'Office Storage', minStock: 1, desc: 'Facility Appliances' },
  { id: 'FIX-020', name: 'WAPDA Meter / Safe Guard Meter', category: 'Electrical & Electronics', type: MATERIAL_TYPES.FIXED, stock: '2 Pic', unit: 'Pic', location: 'Store Power Corner', minStock: 1, desc: 'Energy & Protection Meters' },

  // ─── 2. RETURNABLE MATERIAL (Temporary Field Tools & Reusable Equipment) ───
  { id: 'RET-001', name: 'Gas Cylinder', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '4 Pic', unit: 'Pic', location: 'Gas Storage Cage', minStock: 1, desc: 'LPG / Refrigerant Cylinder' },
  { id: 'RET-002', name: 'Oxygen Cylinder', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Pic', unit: 'Pic', location: 'Gas Storage Cage', minStock: 1, desc: 'Welding Oxygen Cylinder' },
  { id: 'RET-003', name: 'Clamp Meter', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '7 Pic', unit: 'Pic', location: 'Testing Safe', minStock: 2, desc: 'Digital AC/DC Amp Meter' },
  { id: 'RET-004', name: 'Cable Traser', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Pic', unit: 'Pic', location: 'Network Tool Box', minStock: 1, desc: 'Cat6 & Wire Tracer' },
  { id: 'RET-005', name: 'PSI Presure Gage', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Pic', unit: 'Pic', location: 'HVAC Tool Rack', minStock: 1, desc: 'Refrigerant Pressure Gauge' },
  { id: 'RET-006', name: 'Tube Cutter', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '2 Pic', unit: 'Pic', location: 'Plumbing Tool Box', minStock: 1, desc: 'Copper Pipe Cutter' },
  { id: 'RET-007', name: 'Flaring Toll', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '2 Pic', unit: 'Pic', location: 'HVAC Tool Rack', minStock: 1, desc: 'Copper Flaring & Swaging Kit' },
  { id: 'RET-008', name: 'Spanner no 24, 22, 20, 19, 18, 17, 16, 15, 10', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '15 Pic', unit: 'Pic', location: 'Mechanic Wall Board', minStock: 3, desc: 'Ring & Open End Spanners' },
  { id: 'RET-009', name: 'Bearing Puller / Wooden Puller', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '3 Pic', unit: 'Pic', location: 'Heavy Tool Bin', minStock: 1, desc: '2-Jaw & 3-Jaw Pullers' },
  { id: 'RET-010', name: 'Combination Player / Punch Playar', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '3 Pic', unit: 'Pic', location: 'Hand Tool Rack', minStock: 2, desc: 'Heavy Duty Pliers' },
  { id: 'RET-011', name: 'Welding Torch + gage + pipe', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Set', unit: 'Set', location: 'Welding Cage', minStock: 1, desc: 'Gas Welding Kit Complete' },
  { id: 'RET-012', name: 'Ribtor Gun', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Pic', unit: 'Pic', location: 'Hand Tool Rack', minStock: 1, desc: 'Hand Rivet Gun' },
  { id: 'RET-013', name: 'Ranch / Pluge Spiner / Presure Line', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '5 Pic', unit: 'Pic', location: 'HVAC Tool Rack', minStock: 1, desc: 'Adjustable Wrench & Charging Line' },
  { id: 'RET-014', name: 'Hexca (Ari) / Kandy / Garmanda', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '13 Pic', unit: 'Pic', location: 'Masonry Rack', minStock: 2, desc: 'Hacksaw Frame, Trowel & Float' },
  { id: 'RET-015', name: 'Water Level / Meter Tap', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Roll + 2 Pic', unit: 'Pic', location: 'Measurement Bin', minStock: 1, desc: 'Level Tube & Measuring Tape' },
  { id: 'RET-016', name: 'Spray Tank', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '1 Pic', unit: 'Pic', location: 'Plumbing Bay', minStock: 1, desc: 'Pressure Water / Chemical Tank' },
  { id: 'RET-017', name: 'Hammer / Wood Holsa 35mm', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '2 Pic', unit: 'Pic', location: 'Hand Tool Rack', minStock: 1, desc: 'Claw Hammer & 35mm Hole Saw' },
  { id: 'RET-018', name: 'Tin Man Snab / Goat Rod / Cutter', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '4 Pic', unit: 'Pic', location: 'Hand Tool Rack', minStock: 1, desc: 'Sheet Metal Shears, Cutter & Rod' },
  { id: 'RET-019', name: 'Glue Gun', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '3 Pic', unit: 'Pic', location: 'Electrical Drawer', minStock: 1, desc: 'Hot Melt Glue Guns' },
  { id: 'RET-020', name: 'Volt Meter', category: 'Tools & Machinery', type: MATERIAL_TYPES.RETURNABLE, stock: '2 Pic', unit: 'Pic', location: 'Testing Safe', minStock: 1, desc: 'Portable Voltage Tester' },

  // ─── 3. CONSUMABLE MATERIAL (Direct Site Installation & Consumption) ───
  // Electrical & Lighting
  { id: 'CON-001', name: 'SMD Light 12 Watt', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '2 Carton (48 Pic)', unit: 'Carton', location: 'Lighting Shelf B1', minStock: 1, desc: '12W Recessed Panel Light' },
  { id: 'CON-002', name: 'SMD 6" / 8" / 2x2 LED', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '52 Pic', unit: 'Pic', location: 'Lighting Shelf B2', minStock: 5, desc: 'Ceiling Downlights & 2x2 Panels' },
  { id: 'CON-003', name: 'Breaker 3 Pole 63 Amp / 100 Amp / 200 Amp', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '25 Pic', unit: 'Pic', location: 'Switchgear Rack C', minStock: 3, desc: 'Main Distribution Breakers' },
  { id: 'CON-004', name: '4 Pole Breaker 63 Amp / 100 Amp', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '19 Pic', unit: 'Pic', location: 'Switchgear Rack C', minStock: 2, desc: '4P Incoming / Changeover Breakers' },
  { id: 'CON-005', name: 'Single Pole Breaker 10 Amp / 16 Amp / 20 Amp', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '13 Boxes (130 Pic)', unit: 'Box', location: 'Switchgear Rack C', minStock: 3, desc: 'Single Pole Branch Breakers' },
  { id: 'CON-006', name: 'Megnatic Conactor', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '20 Pic', unit: 'Pic', location: 'Control Panel Bin', minStock: 4, desc: 'AC Contactors for Motors & DB' },
  { id: 'CON-007', name: 'Relays / Electrical Relays', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '33 Pic', unit: 'Pic', location: 'Control Panel Bin', minStock: 5, desc: '8-Pin / 11-Pin Control Relays' },
  { id: 'CON-008', name: 'Change Over', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '5 Pic', unit: 'Pic', location: 'Switchgear Rack C', minStock: 2, desc: 'Manual Power Changeover Switch' },
  { id: 'CON-009', name: 'Technology Box 4 / 5 / 6 Hole & Simple', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '27 Pic', unit: 'Pic', location: 'Wiring Accessories', minStock: 5, desc: 'Surface Mount Back Boxes' },
  { id: 'CON-010', name: 'Light Plug / Switch Socket / Phase Plate', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '44 Boxes/Plates', unit: 'Box', location: 'Wiring Accessories', minStock: 5, desc: 'Wall Sockets and Switch Plates' },
  { id: 'CON-011', name: 'Security Camera / Camera Supply', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '13 Pic', unit: 'Pic', location: 'Security Systems Shelf', minStock: 2, desc: 'CCTV Dome/Bullet Cameras & PSU' },
  { id: 'CON-012', name: 'Battery Charger / Battery 90 Watt', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '7 Pic', unit: 'Pic', location: 'Battery Rack', minStock: 2, desc: 'Backup Charger & Battery Units' },
  { id: 'CON-013', name: 'Smoke Detector', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '12 Pic', unit: 'Pic', location: 'Safety Shelf', minStock: 4, desc: 'Optical Smoke Detectors' },
  { id: 'CON-014', name: 'D.B (Distribution Board)', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '5 Pic', unit: 'Pic', location: 'Panel Bay', minStock: 2, desc: 'Metallic DB Enclosure' },
  { id: 'CON-015', name: 'SPD (Surge Protective Device)', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '2 Pic', unit: 'Pic', location: 'Control Panel Bin', minStock: 1, desc: 'Surge Arrester for Lightning' },

  // Wires & Cables
  { id: 'CON-016', name: 'Green Wire 16 mm (Assorted Cuts)', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '1,450 Ft (30+ cuts)', unit: 'Ft', location: 'Cable Drum Bay 2', minStock: 200, desc: 'Grounding & Power Single Core' },
  { id: 'CON-017', name: 'Green Wire 10 mm / 20 mm / 25 mm / 35 mm', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '580 Ft', unit: 'Ft', location: 'Cable Drum Bay 2', minStock: 100, desc: 'Heavy Earthing Copper Cables' },
  { id: 'CON-018', name: 'Green Wire 1.5 mm / 2.5 mm / 4 mm / 6 mm', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '11 Coils + 350 Ft', unit: 'Coil', location: 'Cable Rack 1', minStock: 3, desc: 'Standard Building Wire' },
  { id: 'CON-019', name: 'White / Black / Green Wire Cat 6', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '850 MTR + 3 Coils', unit: 'Meter', location: 'Data Cable Rack', minStock: 100, desc: 'UTP Cat6 Networking Data Cable' },
  { id: 'CON-020', name: '20mm Copper Rasa 50 Ft', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '14 Pic', unit: 'Pic', location: 'Earthing Corner', minStock: 2, desc: 'Bare Copper Earth Conductor Rope' },
  { id: 'CON-021', name: '2 Pair / 4 Pair / 5 Pair Wire', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '480 Ft + 41 MTR', unit: 'Ft', location: 'Telecom Rack', minStock: 50, desc: 'Telephone & Intercom Cable' },
  { id: 'CON-022', name: 'Solar Wire Silver / Red', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '45 Ft + 7 Meter', unit: 'Ft', location: 'Solar Cable Bay', minStock: 20, desc: 'UV Resistant DC Solar Cable' },
  { id: 'CON-023', name: 'Copper Pipe 1/4, 3/8, 1/2, 3/4', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '101 Ft + 1 Coil', unit: 'Ft', location: 'AC Pipe Rack', minStock: 20, desc: 'Refrigerant Copper Piping' },
  { id: 'CON-024', name: 'Camera Roll Wire / Camera White Wire', category: 'Wires & Cables', type: MATERIAL_TYPES.CONSUMABLE, stock: '1 Roll + 80 Ft', unit: 'Roll', location: 'Security Systems Shelf', minStock: 1, desc: 'Coaxial + Power CCTV Cable' },

  // Plumbing & Sanitary
  { id: 'CON-025', name: 'Flush Tank / Basin Mixture', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '2 Pic', unit: 'Pic', location: 'Sanitary Shelf S', minStock: 1, desc: 'Cistern & Basin Mixer Tap' },
  { id: 'CON-026', name: 'Muslim Shower / Towel Hanger', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '8 Pic', unit: 'Pic', location: 'Sanitary Shelf S', minStock: 2, desc: 'Chrome Health Faucets' },
  { id: 'CON-027', name: 'T-Cock / Volve Mixture / Extention Niple', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '23 Pic', unit: 'Pic', location: 'Brass Fittings Drawer', minStock: 5, desc: 'Chrome Brass T-Cocks & Nipples' },
  { id: 'CON-028', name: '25mm / 32mm Elbo, Socket, T & End Cap', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '32 Pic', unit: 'Pic', location: 'PPR Fittings Bin', minStock: 8, desc: 'PPR Hot/Cold Water Fittings' },
  { id: 'CON-029', name: '4 inch / 3 inch / 2 inch Elbo, Socket & Y-T', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '14 Pic', unit: 'Pic', location: 'PVC Drainage Rack', minStock: 4, desc: 'uPVC Waste & Drainage Fittings' },
  { id: 'CON-030', name: 'PVC Solution (Simple) / White Glue', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '2 Cans', unit: 'Can', location: 'Chemical Shelf P', minStock: 2, desc: 'Solvent Cement for PVC Joints' },

  // Hardware, Carpentry & Security
  { id: 'CON-031', name: 'D-Lock / Handle Lock / Glass Lock / Draws Lock', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '34 Pic + 2 Boxes', unit: 'Pic', location: 'Locks Cabinet', minStock: 4, desc: 'Door and Drawer Locks' },
  { id: 'CON-032', name: 'L-Bracket / Glass Catcher / Catcher', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '86 Pic', unit: 'Pic', location: 'Hardware Bin 2', minStock: 15, desc: 'Heavy Corner Brackets & Catchers' },
  { id: 'CON-033', name: 'Silicon Tube / Magic Depoxi / Bond Glue', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '7 Pic/Packs', unit: 'Pic', location: 'Sealant Bin H', minStock: 3, desc: 'Clear Weather Silicon & Adhesives' },
  { id: 'CON-034', name: 'Steel Nails & Screws (3/4, 5/8, 1/2)', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '5 Boxes + 50 Screws', unit: 'Box', location: 'Fastener Bin 3', minStock: 2, desc: 'Wood & Drywall Screws' },
  { id: 'CON-035', name: 'Welding Rod', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '2 Boxes', unit: 'Box', location: 'Welding Cabinet', minStock: 1, desc: 'Mild Steel E6013 Electrodes' },
  { id: 'CON-036', name: 'Tefnet Tape / Tape Fridge-AC', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '13 Pic', unit: 'Pic', location: 'Tape Drawer', minStock: 5, desc: 'Teflon Thread Tape & Insulation' },
  { id: 'CON-037', name: 'Cutter Blade / Pain Screper / Paint Brush', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '58 Pic', unit: 'Pic', location: 'Finishing Tool Bin', minStock: 10, desc: 'Blades, Scrapers & Paint Rollers' },
  { id: 'CON-038', name: 'Cable Tie / Sheudal / Wire Connector', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '4 Packs + 1 Box', unit: 'Pack', location: 'Wiring Accessories', minStock: 2, desc: 'Nylon Cable Ties & Terminal Connectors' },

  // Civil & Flooring
  { id: 'CON-039', name: 'Tile (Floor / Wall)', category: 'Civil & Tiles', type: MATERIAL_TYPES.CONSUMABLE, stock: '128 Box', unit: 'Box', location: 'Ground Floor Yard', minStock: 10, desc: 'Ceramic / Porcelain Tiles' },
  { id: 'CON-040', name: 'Tile Filling & Tile Bond', category: 'Civil & Tiles', type: MATERIAL_TYPES.CONSUMABLE, stock: '6.5 Packs', unit: 'Pack', location: 'Ground Floor Yard', minStock: 2, desc: 'Grout Filler & Tile Adhesive' },

  // Auto / Facility & Remaining Ground Floor Items
  { id: 'CON-041', name: 'Oil Filter Car / Brake Shoe Set / Wheel Cover', category: 'Auto & Facility', type: MATERIAL_TYPES.CONSUMABLE, stock: '12 Pic', unit: 'Pic', location: 'Vehicle Spares Bin', minStock: 2, desc: 'Company Fleet Vehicle Maintenance' },
  { id: 'CON-042', name: 'Mobil Oil 1 LTR / Bike Tube / Shooks / Speed Meter', category: 'Auto & Facility', type: MATERIAL_TYPES.CONSUMABLE, stock: '5 Pic', unit: 'Pic', location: 'Vehicle Spares Bin', minStock: 1, desc: 'Field Motorcycle Maintenance' },
  { id: 'CON-043', name: 'AVR Card', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '14 Pic', unit: 'Pic', location: 'Generator Spares Shelf', minStock: 3, desc: 'Automatic Voltage Regulator Cards' },
  { id: 'CON-044', name: 'WAPDA D FUSE / Fuse Breaker / Fuse', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '3 Boxes + 8 Pic', unit: 'Box', location: 'Switchgear Rack C', minStock: 2, desc: 'Heavy Duty D-Fuses & Holders' },
  { id: 'CON-045', name: 'Industrial Socket / Industrial Shoe 63 Amp', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '21 Pic', unit: 'Pic', location: 'Industrial Plugs Bin', minStock: 4, desc: '3-Phase Industrial Plugs & Sockets' },
  { id: 'CON-046', name: 'Patch Panal / Cable Manager / IO / Cat Six Connector', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '4 Pic + 10 Packs', unit: 'Pack', location: 'Data Rack Shelf', minStock: 2, desc: 'Networking Rack Accessories & RJ45' },
  { id: 'CON-047', name: 'AC Out Door Stand / Solar Plate Stand Hardware', category: 'Hardware & Carpentry', type: MATERIAL_TYPES.CONSUMABLE, stock: '9 Sets', unit: 'Set', location: 'Heavy Bracket Bay', minStock: 2, desc: 'Outdoor Mounting Brackets' },
  { id: 'CON-048', name: '85 Watt Energy Savor / Bulbe Holders / Tube Light', category: 'Electrical & Electronics', type: MATERIAL_TYPES.CONSUMABLE, stock: '12 Pic + 3 Boxes', unit: 'Pic', location: 'Lighting Shelf B1', minStock: 4, desc: 'Bulbs, Tube Lights & Holders' },
  { id: 'CON-049', name: 'Flexible Pipe / Hockey Pipe / Water Pump Bend', category: 'Plumbing & Sanitary', type: MATERIAL_TYPES.CONSUMABLE, stock: '2 Rolls + 4 Pic', unit: 'Roll', location: 'Plumbing Bay', minStock: 1, desc: 'Flexible Conduit & Plumbing Pipes' },
  { id: 'CON-050', name: 'LCD Bracket / LCD Stand / Curtian Rod / Roller Blinder', category: 'Office & Facility', type: MATERIAL_TYPES.CONSUMABLE, stock: '15 Pic', unit: 'Pic', location: 'Office Hardware Bin', minStock: 2, desc: 'Wall Mounts, Curtain Rods & Blinds' },
  { id: 'CON-051', name: 'Chair Weel / Chair Machine / Exaust Jali / Patch Fitting', category: 'Office & Facility', type: MATERIAL_TYPES.CONSUMABLE, stock: '10 Pic', unit: 'Pic', location: 'Office Hardware Bin', minStock: 2, desc: 'Chair Castors, Mechanisms & Fittings' },
];

export const INITIAL_RETURNABLE_TOOL_LOANS = [
  {
    id: 'RET-LOAN-001',
    toolName: 'Gas Cylinder (LPG 15kg)',
    issuedTo: 'Ali Shehzad',
    site: 'Manawala',
    issueDate: '2026-10-28',
    dueDate: '2026-11-03',
    returnDate: null,
    status: 'IN_FIELD',
    condition: 'Active at Site',
  },
  {
    id: 'RET-LOAN-002',
    toolName: 'Clamp Meter (Fluke 302+)',
    issuedTo: 'Shah Zaib',
    site: 'Kanjwahl',
    issueDate: '2026-10-29',
    dueDate: '2026-11-01',
    returnDate: '2026-11-01',
    status: 'RETURNED',
    condition: 'Verified Good Condition',
  },
  {
    id: 'RET-LOAN-003',
    toolName: 'PSI Presure Gage',
    issuedTo: 'Ali Shehzad',
    site: 'Manawala',
    issueDate: '2026-11-01',
    dueDate: '2026-11-04',
    returnDate: null,
    status: 'IN_FIELD',
    condition: 'Testing Compressor Pressure',
  },
  {
    id: 'RET-LOAN-004',
    toolName: 'Drill Machine (Bosch Impact 13mm)',
    issuedTo: 'Muhammad Ibrahim',
    site: 'Muradshah',
    issueDate: '2026-11-02',
    dueDate: '2026-11-05',
    returnDate: null,
    status: 'IN_FIELD',
    condition: 'Anchor Fixing on Trays',
  },
];

export function searchStoreItems(query = '', category = 'ALL', type = 'ALL') {
  const q = (query || '').toLowerCase().trim();
  return GROUND_FLOOR_STORE_CATALOG.filter((item) => {
    const matchQ =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q);
    const matchCat = category === 'ALL' || item.category === category;
    const matchType = type === 'ALL' || item.type === type;
    return matchQ && matchCat && matchType;
  });
}

export function getStoreCategories() {
  const cats = new Set(GROUND_FLOOR_STORE_CATALOG.map((i) => i.category));
  return ['ALL', ...Array.from(cats)];
}

export function getStoreStats() {
  const fixed = GROUND_FLOOR_STORE_CATALOG.filter((i) => i.type === MATERIAL_TYPES.FIXED).length;
  const consumable = GROUND_FLOOR_STORE_CATALOG.filter((i) => i.type === MATERIAL_TYPES.CONSUMABLE).length;
  const returnable = GROUND_FLOOR_STORE_CATALOG.filter((i) => i.type === MATERIAL_TYPES.RETURNABLE).length;
  return {
    total: GROUND_FLOOR_STORE_CATALOG.length,
    fixed,
    consumable,
    returnable,
  };
}
