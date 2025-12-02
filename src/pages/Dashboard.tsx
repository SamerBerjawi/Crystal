  const assetAllocationData: { name: string; value: number; color: string }[] = useMemo(() => {
      const groups = assetGroups as Record<string, { value: number; color: string }>;
      const data = [ // Renamed from pieChartData
      { name: 'Liquid Cash', value: groups['Liquid Cash'].value, color: groups['Liquid Cash'].color },
      { name: 'Investments', value: groups['Investments'].value, color: groups['Investments'].color },
      { name: 'Properties', value: groups['Properties'].value, color: groups['Properties'].color },
      { name: 'Vehicles', value: groups['Vehicles'].value, color: groups['Vehicles'].color },
      { name: 'Other Assets', value: groups['Other Assets'].value, color: groups['Other Assets'].color }
    ] as { name: string; value: number; color: string }[];
      return data.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [assetGroups]);