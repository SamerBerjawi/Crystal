      if (account.symbol && account.type === 'Investment' && assetPrices[account.symbol] !== undefined) {
        const price = assetPrices[account.symbol] as number | null;
        const quantity = warrantHoldingsBySymbol[account.symbol] || 0;
        const calculatedBalance = price !== null ? quantity * price : 0;

        if (Math.abs((account.balance || 0) - calculatedBalance) > 0.0001) {
            hasChanges = true;
            return { ...account, balance: calculatedBalance };
        }
      }