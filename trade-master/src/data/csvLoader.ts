// Automatyczne ładowanie danych z Master Trade Log CSV
import Papa from 'papaparse';

// Funkcja do automatycznego ładowania danych CSV przy starcie aplikacji
export const loadMasterTradeLogCSV = async (): Promise<any[]> => {
  try {
    // Sprawdź czy plik CSV jest dostępny w folderze public
    const response = await fetch('/Master_Trade_Log_1eac4d8c02f88110b087c969c4324ab6_all.csv');
    
    if (!response.ok) {
      console.warn('Master Trade Log CSV nie został znaleziony w folderze public');
      return [];
    }
    
    const csvText = await response.text();
    
    // Parsuj CSV używając Papa Parse
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<any>) => {
          // Konwertuj dane CSV do formatu TradeMaster
          const convertedData = results.data.map((row: any) => {
            return {
              Date: formatDate(row.Date || row.date || ''),
              Coin: row.Coin || row.Instrument || row.Symbol || 'UNKNOWN',
              Position: row.Position || row.Side || 'Long',
              Strategy: row.Strategy || row.Type || 'Manual',
              Timeframe: row.Timeframe || row.TimeFrame || '5m',
              Session: row.Session || row.Market || 'New York',
              Quantity: row.Quantity || row.Size || row.Amount || '1.0',
              HoldingTime: row.HoldingTime || row.Duration || '60',
              StopLoss: row.StopLoss || row.SL || '100.00',
              AccountBalance: row.AccountBalance || row.Balance || '10000.00',
              RiskPercent: row.RiskPercent || row.Risk || '1.0',
              "PnL ": row.PnL || row["PnL "] || row.Profit || '+0.00 PLN',
              "R/Factor": row.RFactor || row["R/Factor"] || row.RR || '1.0',
              Win: row.Win || (parseFloat(row.PnL || '0') > 0 ? 'Yes' : 'No'),
              Loss: row.Loss || (parseFloat(row.PnL || '0') < 0 ? 'Yes' : 'No'),
              "Confidence 1-5": row.Confidence || row["Confidence 1-5"] || '3',
              "Pre Notes": row.PreNotes || row["Pre Notes"] || row.Notes || 'Brak notatek',
              "Post Notes": row.PostNotes || row["Post Notes"] || row.Comments || 'Brak komentarzy'
            };
          });
          
          resolve(convertedData);
        },
        error: (error: any) => {
          console.error('Błąd podczas parsowania CSV:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Błąd podczas ładowania Master Trade Log CSV:', error);
    return [];
  }
};

// Pomocnicza funkcja do formatowania daty
const formatDate = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  try {
    // Próbuj różne formaty daty
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      // MM/DD/YYYY format
      const parts = dateStr.split('/');
      const year = parts[2];
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (dateStr.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
      // MM-DD-YYYY format
      const parts = dateStr.split('-');
      const year = parts[2];
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      // YYYY-MM-DD format (już poprawny)
      return dateStr;
    } else {
      // Próbuj parsować jako Date
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  } catch (error) {
    console.warn('Nie można sparsować daty:', dateStr);
  }
  
  // Fallback - obecna data
  return new Date().toISOString().split('T')[0];
};

export default loadMasterTradeLogCSV;
