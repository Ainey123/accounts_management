"use client";

import React from 'react';
import AppShell from '@/components/AppShell';
import StoreMaterialsModule from '@/components/StoreMaterialsModule';

export default function MaterialsPage() {
  return (
    <AppShell>
      <StoreMaterialsModule defaultBranch="Office Store" />
    </AppShell>
  );
}
