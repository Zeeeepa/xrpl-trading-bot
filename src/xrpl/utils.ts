export function getReadableCurrency(currency: string): string {
    if (!currency) return 'UNKNOWN';
    if (currency.length <= 3) {
        return currency;
    }
    if (currency.length === 40) {
        try {
            const hex = currency.replace(/0+$/, '');
            if (hex.length > 0 && hex.length % 2 === 0) {
                const decoded = Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
                if (decoded && /^[A-Za-z0-9\-_\.]+$/.test(decoded) && decoded.length >= 1) {
                    return decoded;
                }
            }
        } catch (error) {
            // If decoding fails, return original
        }
    }
    return currency;
}

export function hexToString(hex: string): string {
    if (!hex || hex === 'XRP') return hex;
    if (hex.length !== 40) return hex;
    
    try {
        let str = '';
        for (let i = 0; i < hex.length; i += 2) {
            const byte = parseInt(hex.substr(i, 2), 16);
            if (byte === 0) break;
            str += String.fromCharCode(byte);
        }
        return str || hex;
    } catch {
        return hex;
    }
}

export function formatTokenAmountSimple(amount: number | string): string {
    if (typeof amount === 'string') {
        return amount;
    }
    return amount.toFixed(6);
}

export function convertCurrencyToXRPLFormat(currency: string): string {
    if (currency.length <= 3) {
        return currency.padEnd(3, '\0');
    }
    return currency.padEnd(40, '\0').slice(0, 40);
}

export function convertXRPLCurrencyToReadable(xrplCurrency: string): string {
    if (!xrplCurrency) return '';
    if (xrplCurrency.length <= 3) {
        return xrplCurrency.trim();
    }
    if (xrplCurrency.length === 40) {
        try {
            const hex = xrplCurrency.replace(/0+$/, '');
            if (hex.length > 0 && hex.length % 2 === 0) {
                const decoded = Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
                if (decoded && /^[A-Za-z0-9\-_\.]+$/.test(decoded)) {
                    return decoded;
                }
            }
        } catch (error) {
            // If decoding fails, return original
        }
    }
    return xrplCurrency;
}

export function getTransactionTime(txData: any): Date | null {
    try {
        if (txData.tx?.date) {
            return new Date((txData.tx.date + 946684800) * 1000);
        }
        if (txData.date) {
            return new Date((txData.date + 946684800) * 1000);
        }
        return null;
    } catch {
        return null;
    }
}

