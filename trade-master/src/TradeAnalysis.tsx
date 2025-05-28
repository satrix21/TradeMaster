import React, { useState, CSSProperties, useEffect } from 'react';
import Papa from 'papaparse';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { defaultTrades } from './data/defaultTrades';
import { addTrade, updateTrade, deleteTrade, subscribeToTrades } from './firebaseTrades';

const TradeAnalysis: React.FC = () => {
  const [trades, setTrades] = useState<any[]>([]);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);
  const [plan, setPlan] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [tradesPerPage, setTradesPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<any>(null);
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    Date: true,
    Instrument: true,
    Position: true,
    Strategy: true,
    Timeframe: true,
    Session: true,
    Quantity: true,
    HoldingTime: true,
    StartTime: false,
    EndTime: false,
    StopLoss: true,
    AccountBalance: true,
    RiskPercent: true,
    PnL: true,
    RFactor: true,
    Win: true,
    Loss: true,
    Confidence: true,
    PreNotes: false,
    PostNotes: false,
    Actions: true
  });
  const [newTrade, setNewTrade] = useState({
    Date: new Date().toISOString().split('T')[0],
    Coin: '',
    Position: 'Long',
    Strategy: 'Scalp',
    Timeframe: '5m',
    Session: 'New York',
    Quantity: '',
    HoldingTime: '',
    StopLoss: '',
    AccountBalance: '',
    RiskPercent: '',
    'PnL ': '',
    'R/Factor': '',
    Win: 'No',
    Loss: 'No',
    'Confidence 1-5': '3',
    'Pre Notes': '',
    'Post Notes': '',
    StartTime: '',
    EndTime: '',
    IsActive: false
  });

  // State for end trade modal
  const [showEndTradeModal, setShowEndTradeModal] = useState(false);
  const [tradeToEnd, setTradeToEnd] = useState<any>(null);
  const [endTradeTime, setEndTradeTime] = useState('');
  // Helper: Parse CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        // Validate and clean data before setting
        const cleanedData = results.data.map((row: any) => {
          // Normalize date format if needed
          if (row.Date) {
            // Try to handle different date formats
            const dateStr = row.Date.toString().trim();
            if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              // Convert MM/DD/YYYY or DD/MM/YYYY to YYYY-MM-DD
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const year = parts[2];
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                row.Date = `${year}-${month}-${day}`;
              }
            } else if (dateStr.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
              // Convert MM-DD-YYYY or DD-MM-YYYY to YYYY-MM-DD
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                const year = parts[2];
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                row.Date = `${year}-${month}-${day}`;
              }
            }
            // If already in YYYY-MM-DD format or other valid ISO format, keep as is
          }
          return row;
        });
        setter(cleanedData);
      }
    });
  };
  // Calculate stats from trades
  useEffect(() => {
    if (!trades.length) return;
    let total = 0, win = 0, loss = 0, rSum = 0, rCount = 0;
    let dailyPnL: { [key: string]: number } = {};
    let monthlyPnL: { [key: string]: number } = {};
    let coinStats: { [key: string]: { total: number, trades: number } } = {};
    
    // New analytical stats
    let strategyStats: { [key: string]: { total: number, trades: number, wins: number } } = {};
    let timeframeStats: { [key: string]: number } = {};
    let sessionStats: { [key: string]: { total: number, trades: number, wins: number } } = {};
    let positionStats: { [key: string]: { total: number, trades: number, wins: number } } = {};
    let confidenceStats: { [key: string]: { total: number, trades: number, wins: number } } = {};
    let rFactorRanges: { [key: string]: number } = {};
    
    trades.forEach(t => {
      const pnl = parseFloat((t['PnL ']||'').replace(/[^-\d.,]/g, '').replace(',', '.'));
      const isWin = t.Win === 'Yes';
      
      if (!isNaN(pnl)) {
        total += pnl;
          // Daily PnL
        const date = t.Date;
        if (date && typeof date === 'string' && date.trim()) {
          const cleanDate = date.trim();
          dailyPnL[cleanDate] = (dailyPnL[cleanDate] || 0) + pnl;
          
          // Extract month safely
          try {
            let month;
            if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // YYYY-MM-DD format
              month = cleanDate.substring(0, 7);
            } else if (cleanDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              // MM/DD/YYYY format
              const parts = cleanDate.split('/');
              month = `${parts[2]}-${parts[0].padStart(2, '0')}`;
            } else {
              // Fallback - try to extract year and month
              month = cleanDate.substring(0, 7);
            }
            
            if (month) {
              monthlyPnL[month] = (monthlyPnL[month] || 0) + pnl;
            }
          } catch (error) {
            console.warn(`Error processing date: ${cleanDate}`);
          }
        }
        
        // Coin stats
        const coin = t.Coin;
        if (coin) {
          if (!coinStats[coin]) coinStats[coin] = { total: 0, trades: 0 };
          coinStats[coin].total += pnl;
          coinStats[coin].trades += 1;
        }

        // Strategy stats
        const strategy = t.Strategy;
        if (strategy) {
          if (!strategyStats[strategy]) strategyStats[strategy] = { total: 0, trades: 0, wins: 0 };
          strategyStats[strategy].total += pnl;
          strategyStats[strategy].trades += 1;
          if (isWin) strategyStats[strategy].wins += 1;
        }

        // Session stats
        const session = t.Session;
        if (session) {
          if (!sessionStats[session]) sessionStats[session] = { total: 0, trades: 0, wins: 0 };
          sessionStats[session].total += pnl;
          sessionStats[session].trades += 1;
          if (isWin) sessionStats[session].wins += 1;
        }

        // Position stats
        const position = t.Position;
        if (position) {
          if (!positionStats[position]) positionStats[position] = { total: 0, trades: 0, wins: 0 };
          positionStats[position].total += pnl;
          positionStats[position].trades += 1;
          if (isWin) positionStats[position].wins += 1;
        }

        // Confidence stats
        const confidence = t['Confidence 1-5'];
        if (confidence) {
          if (!confidenceStats[confidence]) confidenceStats[confidence] = { total: 0, trades: 0, wins: 0 };
          confidenceStats[confidence].total += pnl;
          confidenceStats[confidence].trades += 1;
          if (isWin) confidenceStats[confidence].wins += 1;
        }
      }
      
      // Timeframe stats (count only)
      const timeframe = t.Timeframe;
      if (timeframe) {
        timeframeStats[timeframe] = (timeframeStats[timeframe] || 0) + 1;
      }

      // R/Factor distribution
      const r = parseFloat((t['R/Factor']||'').replace(',', '.'));
      if (!isNaN(r)) {
        rSum += r;
        rCount++;
        
        let range = 'Unknown';
        if (r <= -1) range = '≤ -1.0';
        else if (r <= -0.5) range = '-1.0 to -0.5';
        else if (r <= 0) range = '-0.5 to 0';
        else if (r <= 0.5) range = '0 to 0.5';
        else if (r <= 1) range = '0.5 to 1.0';
        else if (r <= 2) range = '1.0 to 2.0';
        else range = '> 2.0';
        
        rFactorRanges[range] = (rFactorRanges[range] || 0) + 1;
      }
      
      if (t.Win === 'Yes') win++;
      if (t.Loss === 'Yes') loss++;
    });
      const dailyPnLArray = Object.entries(dailyPnL)
      .map(([date, pnl]) => {
        let formattedDate = date;
        try {
          // Try to parse and format the date
          const parsedDate = parseISO(date);
          if (!isNaN(parsedDate.getTime())) {
            formattedDate = format(parsedDate, 'dd/MM');
          }
        } catch (error) {
          // If parsing fails, use the original date string
          console.warn(`Invalid date format: ${date}`);
          formattedDate = date.substring(5); // Show MM-DD if YYYY-MM-DD format
        }
        return { date, pnl, formattedDate };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const monthlyPnLArray = Object.entries(monthlyPnL)
      .map(([month, pnl]) => ({ month, pnl }))
      .sort((a, b) => a.month.localeCompare(b.month));
      const coinStatsArray = Object.entries(coinStats)
      .map(([coin, data]) => ({ coin, ...data, avgPnL: data.total / data.trades }))
      .sort((a, b) => b.total - a.total);

    // Process new stats arrays
    const strategyStatsArray = Object.entries(strategyStats)
      .map(([strategy, data]) => ({ 
        strategy, 
        ...data, 
        avgPnL: data.total / data.trades,
        winRate: (data.wins / data.trades) * 100
      }))
      .sort((a, b) => b.avgPnL - a.avgPnL);

    const timeframeStatsArray = Object.entries(timeframeStats)
      .map(([timeframe, trades]) => ({ timeframe, trades }))
      .sort((a, b) => b.trades - a.trades);

    const sessionStatsArray = Object.entries(sessionStats)
      .map(([session, data]) => ({ 
        session, 
        ...data, 
        avgPnL: data.total / data.trades,
        winRate: (data.wins / data.trades) * 100
      }))
      .sort((a, b) => b.avgPnL - a.avgPnL);

    const positionStatsArray = Object.entries(positionStats)
      .map(([position, data]) => ({ 
        position, 
        ...data, 
        avgPnL: data.total / data.trades,
        winRate: (data.wins / data.trades) * 100
      }))
      .sort((a, b) => b.avgPnL - a.avgPnL);

    const confidenceStatsArray = Object.entries(confidenceStats)
      .map(([confidence, data]) => ({ 
        confidence: `Level ${confidence}`, 
        ...data, 
        avgPnL: data.total / data.trades,
        winRate: (data.wins / data.trades) * 100
      }))
      .sort((a, b) => a.confidence.localeCompare(b.confidence));

    const rFactorStatsArray = Object.entries(rFactorRanges)
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => {
        const order = ['≤ -1.0', '-1.0 to -0.5', '-0.5 to 0', '0 to 0.5', '0.5 to 1.0', '1.0 to 2.0', '> 2.0'];
        return order.indexOf(a.range) - order.indexOf(b.range);
      });
    
    setStats({
      totalTrades: trades.length,
      totalPnL: total,
      winRate: win / trades.length * 100,
      lossRate: loss / trades.length * 100,
      avgR: rCount ? rSum / rCount : 0,
      winTrades: win,
      lossTrades: loss,
      avgPnL: total / trades.length,
      dailyPnL: dailyPnLArray,
      monthlyPnL: monthlyPnLArray,
      coinStats: coinStatsArray,
      strategyStats: strategyStatsArray,
      timeframeStats: timeframeStatsArray,
      sessionStats: sessionStatsArray,
      positionStats: positionStatsArray,
      confidenceStats: confidenceStatsArray,
      rFactorStats: rFactorStatsArray
    });
  }, [trades]);
  // Firestore real-time sync for trades
  useEffect(() => {
    const unsubscribe = subscribeToTrades((tradesFromFirestore) => {
      console.log('Firebase trades received:', tradesFromFirestore.length);
      
      // If this is the first load and Firestore is empty, populate with default trades
      if (!isFirebaseLoaded && tradesFromFirestore.length === 0) {
        console.log('Firestore is empty, populating with default trades...');
        // Add default trades to Firestore one by one
        defaultTrades.forEach(async (trade) => {
          await addTrade(trade);
        });
      } else {
        // Normal operation - update trades from Firestore
        setTrades(tradesFromFirestore);
      }
      
      setIsFirebaseLoaded(true);
    });
    return () => unsubscribe();
  }, [isFirebaseLoaded]);

  // Save to localStorage whenever trades or plan changes
  useEffect(() => {
    try {
      localStorage.setItem('tradeMaster_plan', JSON.stringify(plan));
    } catch (error) {
      console.error('Error saving plan to localStorage:', error);
    }
  }, [plan]);

  // Calculate risk percentage automatically
  const calculateRiskPercent = (stopLoss: string, accountBalance: string) => {
    const sl = parseFloat(stopLoss.replace(/[^-\d.,]/g, '').replace(',', '.'));
    const balance = parseFloat(accountBalance.replace(/[^-\d.,]/g, '').replace(',', '.'));
    
    if (!isNaN(sl) && !isNaN(balance) && balance > 0) {
      const riskPercent = (sl / balance) * 100;
      return riskPercent.toFixed(2);
    }
    return '';
  };

  // Handle stop loss or account balance change
  const handleRiskCalculation = (field: string, value: string) => {
    const updatedTrade = { ...newTrade, [field]: value };
    
    if (field === 'StopLoss' || field === 'AccountBalance') {
      const riskPercent = calculateRiskPercent(
        field === 'StopLoss' ? value : newTrade.StopLoss,
        field === 'AccountBalance' ? value : newTrade.AccountBalance
      );
      updatedTrade.RiskPercent = riskPercent;
    }
    
    setNewTrade(updatedTrade);
  };
  // Add new trade
  const handleAddTrade = async () => {
    // For active trades (with start time but no PnL), only instrument is required
    // For completed trades, both instrument and PnL are required
    const isActiveTrade = newTrade.StartTime && !newTrade['PnL '];
    if (!newTrade.Coin) {
      alert('Uzupełnij instrument!');
      return;
    }
    if (!isActiveTrade && !newTrade['PnL ']) {
      alert('Uzupełnij PnL dla zakończonej transakcji!');
      return;
    }
    let processedPnL = '';
    let winStatus = 'No';
    let lossStatus = 'No';
    if (!isActiveTrade && newTrade['PnL ']) {
      const pnl = parseFloat(newTrade['PnL '].replace(/[^-\d.,]/g, '').replace(',', '.'));
      processedPnL = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} PLN`;
      winStatus = pnl > 0 ? 'Yes' : 'No';
      lossStatus = pnl < 0 ? 'Yes' : 'No';
    }
    const updatedTrade = {
      ...newTrade,
      'PnL ': processedPnL,
      Win: winStatus,
      Loss: lossStatus,
      IsActive: isActiveTrade
    };
    await addTrade(updatedTrade);
    setNewTrade({
      Date: new Date().toISOString().split('T')[0],
      Coin: '',
      Position: 'Long',
      Strategy: 'Scalp',
      Timeframe: '5m',
      Session: 'New York',
      Quantity: '',
      HoldingTime: '',
      StopLoss: '',
      AccountBalance: '',
      RiskPercent: '',
      'PnL ': '',
      'R/Factor': '',
      Win: 'No',
      Loss: 'No',
      'Confidence 1-5': '3',
      'Pre Notes': '',
      'Post Notes': '',
      StartTime: '',
      EndTime: '',
      IsActive: false
    });
    setShowAddForm(false);
  };  // Delete trade
  const handleDeleteTrade = async (index: number) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę transakcję?')) {
      // Convert the index from the paginated display to the actual reversed trades array
      const reversedTrades = trades.slice().reverse();
      const trade = reversedTrades[index];
      if (trade && trade.id) {
        await deleteTrade(trade.id);
      }
    }
  };
  // Start editing trade
  const handleEditTrade = (trade: any) => {
    setEditingTradeId(trade.id);
    setEditingTrade({...trade});
  };

  // Save edited trade
  const handleSaveEditedTrade = async () => {
    if (!editingTrade.Coin || !editingTrade['PnL ']) {
      alert('Uzupełnij instrument i PnL!');
      return;
    }
    const pnl = parseFloat(editingTrade['PnL '].toString().replace(/[^-\d.,]/g, '').replace(',', '.'));
    const updatedTrade = {
      ...editingTrade,
      'PnL ': `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} PLN`,
      Win: pnl > 0 ? 'Yes' : 'No',
      Loss: pnl < 0 ? 'Yes' : 'No'
    };    if (updatedTrade.id) {
      const { id, ...data } = updatedTrade;
      await updateTrade(id, data);
    }
    setEditingTradeId(null);
    setEditingTrade(null);
  };  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTradeId(null);
    setEditingTrade(null);
  };
  // Open end trade modal
  const handleOpenEndTradeModal = (trade: any, index: number) => {
    setTradeToEnd({...trade, originalIndex: index});
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setEndTradeTime(currentTime);
    setShowEndTradeModal(true);
  };
  // End trade with specified time
  const handleEndTrade = async () => {
    if (!tradeToEnd || !endTradeTime) {
      alert('Podaj czas zakończenia!');
      return;
    }
    // Calculate holding time if start time exists
    let calculatedHoldingTime = '';
    if (tradeToEnd.StartTime && endTradeTime) {
      const [startHour, startMin] = tradeToEnd.StartTime.split(':').map(Number);
      const [endHour, endMin] = endTradeTime.split(':').map(Number);
      
      let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight trades
      
      calculatedHoldingTime = totalMinutes.toString();
    }
    const updatedTrade = {
      ...tradeToEnd,
      EndTime: endTradeTime,
      HoldingTime: calculatedHoldingTime || tradeToEnd.HoldingTime,
      IsActive: false
    };
    if (updatedTrade.id) {
      const { id, ...data } = updatedTrade;
      await updateTrade(id, data);
    }
    setShowEndTradeModal(false);
    setTradeToEnd(null);
    setEndTradeTime('');
  };

  // Cancel end trade modal
  const handleCancelEndTrade = () => {
    setShowEndTradeModal(false);
    setTradeToEnd(null);
    setEndTradeTime('');
  };

  // Calculate pagination
  const totalPages = Math.ceil(trades.length / tradesPerPage);
  const startIndex = (currentPage - 1) * tradesPerPage;
  const endIndex = startIndex + tradesPerPage;
  const currentTrades = trades.slice().reverse().slice(startIndex, endIndex);
  // Clear all trades
  const handleClearAllTrades = async () => {
    if (window.confirm('Czy na pewno chcesz usunąć WSZYSTKIE transakcje? Ta akcja jest nieodwracalna!')) {
      // Delete all trades from Firestore
      for (const trade of trades) {
        if (trade.id) {
          await deleteTrade(trade.id);
        }
      }
    }
  };
  // Reset to default trades
  const handleResetToDefault = async () => {
    if (window.confirm('Czy chcesz przywrócić domyślne transakcje? Obecne dane zostaną zastąpione.')) {
      // First delete all existing trades
      for (const trade of trades) {
        if (trade.id) {
          await deleteTrade(trade.id);
        }
      }
      
      // Then add default trades
      for (const trade of defaultTrades) {
        await addTrade(trade);
      }
    }
  };

  // Export data to file
  const handleExportData = () => {
    const dataToExport = {
      trades,
      plan,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `tradeMaster_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };
  // Import data from file
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.trades && Array.isArray(importedData.trades)) {
          if (window.confirm('Czy chcesz zaimportować dane? Obecne transakcje zostaną zastąpione.')) {
            // First delete all existing trades from Firestore
            for (const trade of trades) {
              if (trade.id) {
                await deleteTrade(trade.id);
              }
            }
            
            // Then add imported trades to Firestore
            for (const trade of importedData.trades) {
              const { id, ...tradeData } = trade; // Remove id if present
              await addTrade(tradeData);
            }
            
            // Update plan if included in import
            if (importedData.plan && Array.isArray(importedData.plan)) {
              setPlan(importedData.plan);
            }
            
            alert('Dane zostały pomyślnie zaimportowane!');
          }
        } else {
          alert('Nieprawidłowy format pliku!');
        }
      } catch (error) {
        alert('Błąd podczas importowania pliku!');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    e.target.value = '';
  };
  // Clear localStorage
  const handleClearStorage = async () => {
    if (window.confirm('Czy na pewno chcesz wyczyścić wszystkie zapisane dane z przeglądarki? Ta akcja jest nieodwracalna!')) {
      // Clear localStorage
      localStorage.removeItem('tradeMaster_trades');
      localStorage.removeItem('tradeMaster_plan');
      
      // Clear Firestore trades
      for (const trade of trades) {
        if (trade.id) {
          await deleteTrade(trade.id);
        }
      }
      
      // Reset plan
      setPlan([]);
      alert('Pamięć lokalna została wyczyszczona!');
    }
  };

  // UI styles
  const containerStyle: CSSProperties = {
    maxWidth: '100%',
    width: '100%',
    margin: '0 auto',
    padding: '0'
  };
  const sectionStyle: CSSProperties = {
    padding: '2rem',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 255, 136, 0.2)',
    borderRadius: '16px',
    margin: '2rem 0',
    border: '2px solid rgba(0, 255, 136, 0.3)'
  };

  const headingStyle: CSSProperties = {
    fontSize: '2rem',
    fontWeight: '700',
    marginBottom: '1.5rem',
    color: '#00ff88',
    textAlign: 'center',
    textShadow: '0 0 10px rgba(0, 255, 136, 0.5)'
  };

  const subHeadingStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
    marginTop: '2rem',
    color: '#66ff99',
    borderBottom: '2px solid #00ff88',
    paddingBottom: '0.5rem'
  };

  const statsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
    margin: '1.5rem 0'
  };
  const statCardStyle: CSSProperties = {
    padding: '1.5rem',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    border: '2px solid rgba(0, 255, 136, 0.3)',
    borderRadius: '12px',
    textAlign: 'center',
    transition: 'transform 0.2s ease',
    color: '#00ff88'
  };  const tableContainerStyle: CSSProperties = {
    overflowX: 'auto',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 255, 136, 0.2)',
    margin: '1rem 0',
    minHeight: '400px',
    border: '2px solid rgba(0, 255, 136, 0.3)'
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    minWidth: '1800px', // Minimum width to accommodate all columns
    borderCollapse: 'collapse' as CSSProperties['borderCollapse'],
    backgroundColor: '#0a0a0a',
    borderRadius: '12px',
    overflow: 'hidden'
  };

  const thStyle: CSSProperties = {
    backgroundColor: '#00ff88',
    color: '#000000',
    padding: '0.75rem 0.5rem',
    textAlign: 'left' as CSSProperties['textAlign'],
    fontWeight: '600',
    fontSize: '0.8rem',
    borderBottom: 'none',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 10
  };

  const tdStyle: CSSProperties = {
    padding: '0.5rem',
    borderBottom: '1px solid #333333',
    fontSize: '0.8rem',
    color: '#66ff99',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    backgroundColor: '#1a1a1a'
  };

  const fileInputStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '2rem'
  };
  const labelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontWeight: '600',
    color: '#00ff88'
  };  const inputStyle: CSSProperties = {
    padding: '0.75rem',
    border: '2px solid #00ff88',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'border-color 0.2s ease',
    backgroundColor: '#1a1a1a',
    color: '#66ff99'
  };
  const buttonStyle: CSSProperties = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#00ff88',
    color: '#000000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 255, 136, 0.3)'
  };
  const formStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    padding: '2rem',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    borderRadius: '12px',
    border: '2px solid rgba(0, 255, 136, 0.2)',
    margin: '1rem 0'
  };

  const chartContainerStyle: CSSProperties = {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(0, 255, 136, 0.2)',
    margin: '1rem 0',
    border: '2px solid rgba(0, 255, 136, 0.3)'
  };
  // Chart colors - Black and Green theme
  const colors = ['#00ff88', '#66ff99', '#33ff66', '#99ff99', '#22cc55', '#11aa44', '#00cc66'];  return (
    <div style={containerStyle}>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>📊 Analiza Transakcji</h2>
          {/* Storage Status Info */}
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          border: '2px solid rgba(0, 255, 136, 0.3)',
          borderRadius: '8px',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <p style={{margin: '0', color: '#00ff88', fontWeight: '600'}}>
            💾 Wszystkie zmiany są automatycznie zapisywane w przeglądarce
          </p>
          <p style={{margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#66ff99'}}>
            Aktualnie zapisanych: {trades.length} transakcji • {plan.length} pozycji planu
          </p>
        </div>
        
        <div style={fileInputStyle}>
          <label style={labelStyle}>
            📁 Wgraj dodatkowe transakcje (CSV):
            <input 
              type="file" 
              accept=".csv" 
              onChange={e => handleFileUpload(e, (newTrades: any[]) => setTrades([...trades, ...newTrades]))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            📋 Wgraj plan dnia (CSV):
            <input 
              type="file" 
              accept=".csv" 
              onChange={e => handleFileUpload(e, setPlan)}
              style={inputStyle}
            />
          </label>
        </div>        <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
          {/* Mobile Quick Add Button */}
          {window.innerWidth <= 768 && (
            <button 
              style={{...buttonStyle, backgroundColor: '#e74c3c', flex: '1', minWidth: '200px'}}
              onClick={() => setShowAddForm(!showAddForm)}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
            >
              📱 {showAddForm ? '❌ Zamknij' : '⚡ Szybki Trade'}
            </button>
          )}
          
          <button 
            style={buttonStyle}
            onClick={() => setShowAddForm(!showAddForm)}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
          >
            {showAddForm ? '❌ Anuluj' : '➕ Dodaj Nową Transakcję'}
          </button>
          
          <button 
            style={{...buttonStyle, backgroundColor: '#f39c12'}}
            onClick={handleResetToDefault}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e67e22'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f39c12'}
          >
            🔄 Przywróć Domyślne
          </button>

          {trades.length > 0 && (
            <button 
              style={{...buttonStyle, backgroundColor: '#e74c3c'}}
              onClick={handleClearAllTrades}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
            >
              🗑️ Usuń Wszystkie
            </button>
          )}

          <button 
            style={{...buttonStyle, backgroundColor: '#2ecc71'}}
            onClick={handleExportData}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2ecc71'}
          >
            💾 Eksportuj Dane
          </button>

          <label style={{...buttonStyle, backgroundColor: '#9b59b6', cursor: 'pointer', display: 'inline-block'}}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#8e44ad'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9b59b6'}
          >
            📁 Importuj Dane
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportData}
              style={{display: 'none'}}
            />
          </label>

          <button 
            style={{...buttonStyle, backgroundColor: '#e67e22'}}
            onClick={handleClearStorage}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d35400'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e67e22'}
          >
            🧹 Wyczyść Pamięć
          </button>
        </div>        {showAddForm && (
          <form className="trade-form" style={formStyle}>
            <div>
              <label style={labelStyle}>
                Data:
                <input
                  className="trade-input"
                  type="date"
                  value={newTrade.Date}
                  onChange={(e) => setNewTrade({...newTrade, Date: e.target.value})}
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Czas rozpoczęcia (opcjonalny):
                <input 
                  className="trade-input"
                  type="time" 
                  value={newTrade.StartTime}
                  onChange={(e) => setNewTrade({...newTrade, StartTime: e.target.value})}
                  style={inputStyle}
                  placeholder="np. 14:30"
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Instrument:
                <input 
                  className="trade-input"
                  type="text" 
                  value={newTrade.Coin}
                  onChange={(e) => setNewTrade({...newTrade, Coin: e.target.value})}
                  placeholder="np. BTCUSD, GOLD"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Pozycja:
                <select 
                  value={newTrade.Position}
                  onChange={(e) => setNewTrade({...newTrade, Position: e.target.value})}
                  style={inputStyle}
                >
                  <option value="Long">Long</option>
                  <option value="Short">Short</option>
                </select>
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Strategia:
                <select 
                  value={newTrade.Strategy}
                  onChange={(e) => setNewTrade({...newTrade, Strategy: e.target.value})}
                  style={inputStyle}
                >
                  <option value="Scalp">Scalp</option>
                  <option value="Day Trade">Day Trade</option>
                  <option value="Swing">Swing</option>
                  <option value="Support/RSI">Support/RSI</option>
                  <option value="Breakout">Breakout</option>
                  <option value="Breakout+Wick">Breakout+Wick</option>
                </select>
              </label>
            </div>
            <div>              <label style={labelStyle}>
                Timeframe:
                <select 
                  value={newTrade.Timeframe}
                  onChange={(e) => setNewTrade({...newTrade, Timeframe: e.target.value})}
                  style={inputStyle}
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="1h">1h</option>
                  <option value="2h">2h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                  <option value="1w">1w</option>
                  <option value="1M">1M</option>
                </select>
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Sesja:
                <select 
                  value={newTrade.Session}
                  onChange={(e) => setNewTrade({...newTrade, Session: e.target.value})}
                  style={inputStyle}
                >
                  <option value="New York">New York</option>
                  <option value="London">London</option>
                  <option value="Tokyo">Tokyo</option>
                </select>
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Ilość:
                <input 
                  className="trade-input"
                  type="text" 
                  value={newTrade.Quantity}
                  onChange={(e) => setNewTrade({...newTrade, Quantity: e.target.value})}
                  placeholder="np. 0.5, 10.0, 50000"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Czas trzymania (min):
                <input 
                  className="trade-input"
                  type="number" 
                  value={newTrade.HoldingTime}
                  onChange={(e) => setNewTrade({...newTrade, HoldingTime: e.target.value})}
                  placeholder="np. 25"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Stop Loss (PLN):
                <input 
                  className="trade-input"
                  type="number" 
                  step="0.01"
                  value={newTrade.StopLoss}
                  onChange={(e) => handleRiskCalculation('StopLoss', e.target.value)}
                  placeholder="np. 150.00"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Saldo konta (PLN):
                <input 
                  className="trade-input"
                  type="number" 
                  step="0.01"
                  value={newTrade.AccountBalance}
                  onChange={(e) => handleRiskCalculation('AccountBalance', e.target.value)}
                  placeholder="np. 10000.00"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Ryzyko (%):
                <input 
                  className="trade-input"
                  type="number" 
                  step="0.01"
                  value={newTrade.RiskPercent}
                  onChange={(e) => setNewTrade({...newTrade, RiskPercent: e.target.value})}
                  placeholder="Oblicza się automatycznie"
                  style={{...inputStyle, backgroundColor: '#0a0a0a', color: '#888888'}}
                  readOnly
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                PnL (PLN):
                <input 
                  className="trade-input"
                  type="number" 
                  step="0.01"
                  value={newTrade['PnL '].replace(/[^-\d.,]/g, '')}
                  onChange={(e) => setNewTrade({...newTrade, 'PnL ': e.target.value})}
                  placeholder="np. 150.50 lub -85.20"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                R/Factor:
                <input 
                  className="trade-input"
                  type="number" 
                  step="0.1"
                  value={newTrade['R/Factor']}
                  onChange={(e) => setNewTrade({...newTrade, 'R/Factor': e.target.value})}
                  placeholder="np. 1.5"
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Confidence (1-5):
                <select 
                  value={newTrade['Confidence 1-5']}
                  onChange={(e) => setNewTrade({...newTrade, 'Confidence 1-5': e.target.value})}
                  style={inputStyle}
                >
                  <option value="1">1 - Bardzo niska</option>
                  <option value="2">2 - Niska</option>
                  <option value="3">3 - Średnia</option>
                  <option value="4">4 - Wysoka</option>
                  <option value="5">5 - Bardzo wysoka</option>
                </select>
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Pre Notes:
                <textarea 
                  value={newTrade['Pre Notes']}
                  onChange={(e) => setNewTrade({...newTrade, 'Pre Notes': e.target.value})}
                  placeholder="Notatki przed wejściem w pozycję..."
                  style={{...inputStyle, minHeight: '60px', resize: 'vertical'}}
                />
              </label>
            </div>
            <div>
              <label style={labelStyle}>
                Post Notes:
                <textarea 
                  value={newTrade['Post Notes']}
                  onChange={(e) => setNewTrade({...newTrade, 'Post Notes': e.target.value})}
                  placeholder="Notatki po zamknięciu pozycji..."
                  style={{...inputStyle, minHeight: '60px', resize: 'vertical'}}
                />
              </label>
            </div>
            <div style={{display: 'flex', gap: '1rem', gridColumn: '1 / -1'}}>
              <button 
                style={{...buttonStyle, backgroundColor: '#2ecc71'}}
                onClick={handleAddTrade}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2ecc71'}
              >
                ✅ Dodaj Transakcję
              </button>
              <button 
                style={{...buttonStyle, backgroundColor: '#e74c3c'}}
                onClick={() => setShowAddForm(false)}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
              >
                ❌ Anuluj
              </button>
            </div>
          </form>
        )}

        {trades.length > 0 && (
          <>
            <h3 style={subHeadingStyle}>📈 Statystyki</h3>
            <div style={statsGridStyle}>
              <div style={statCardStyle}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#3498db'}}>Liczba transakcji</h4>
                <p style={{fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#2c3e50'}}>
                  {(stats.totalTrades ?? 0)}
                </p>
              </div>
              <div style={statCardStyle}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#27ae60'}}>Suma PnL</h4>
                <p style={{fontSize: '2rem', fontWeight: 'bold', margin: 0, color: stats.totalPnL >= 0 ? '#27ae60' : '#e74c3c'}}>
                  {(stats.totalPnL ?? 0).toFixed(2)} PLN
                </p>
              </div>
              <div style={statCardStyle}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#f39c12'}}>Win Rate</h4>
                <p style={{fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#2c3e50'}}>
                  {(stats.winRate ?? 0).toFixed(1)}%
                </p>
              </div>
              <div style={statCardStyle}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#9b59b6'}}>Średni R/Factor</h4>
                <p style={{fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#2c3e50'}}>
                  {(stats.avgR ?? 0).toFixed(2)}
                </p>
              </div>
              <div style={statCardStyle}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#e74c3c'}}>Loss Rate</h4>
                <p style={{fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#2c3e50'}}>
                  {(stats.lossRate ?? 0).toFixed(1)}%
                </p>
              </div>
              <div style={statCardStyle}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#1abc9c'}}>Średni PnL</h4>
                <p style={{fontSize: '2rem', fontWeight: 'bold', margin: 0, color: stats.avgPnL >= 0 ? '#27ae60' : '#e74c3c'}}>
                  {(stats.avgPnL ?? 0).toFixed(2)} PLN
                </p>
              </div>
            </div>

            {/* Transactions Table Section */}
            <h3 style={subHeadingStyle}>📋 Tabela Transakcji</h3>
            
            {/* Pagination Controls */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0', flexWrap: 'wrap', gap: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <span style={{color: '#66ff99', fontWeight: '600'}}>Transakcji na stronę:</span>
                <select 
                  value={tradesPerPage} 
                  onChange={(e) => {
                    setTradesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{...inputStyle, width: 'auto'}}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <button 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    ...buttonStyle, 
                    backgroundColor: currentPage === 1 ? '#555555' : '#3498db',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  ◀ Poprzednia
                </button>
                
                <span style={{color: '#66ff99', fontWeight: '600', padding: '0 1rem'}}>
                  Strona {currentPage} z {totalPages}
                </span>
                
                <button 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    ...buttonStyle, 
                    backgroundColor: currentPage === totalPages ? '#555555' : '#3498db',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Następna ▶
                </button>
              </div>
            </div>

            {/* Column Visibility Controls */}
            <div style={{marginBottom: '1rem'}}>
              <details style={{backgroundColor: 'rgba(0, 255, 136, 0.1)', padding: '1rem', borderRadius: '8px', border: '2px solid rgba(0, 255, 136, 0.3)'}}>
                <summary style={{color: '#00ff88', fontWeight: '600', cursor: 'pointer', marginBottom: '1rem'}}>
                  🔧 Konfiguracja Kolumn
                </summary>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem'}}>
                  {Object.entries(visibleColumns).map(([column, visible]) => (
                    <label key={column} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#66ff99'}}>
                      <input 
                        type="checkbox" 
                        checked={visible}
                        onChange={(e) => setVisibleColumns({...visibleColumns, [column]: e.target.checked})}
                        style={{accentColor: '#00ff88'}}
                      />                      {column === 'Instrument' ? 'Instrument' : 
                       column === 'PnL' ? 'PnL' : 
                       column === 'RFactor' ? 'R/Factor' : 
                       column === 'PreNotes' ? 'Pre Notes' : 
                       column === 'PostNotes' ? 'Post Notes' : 
                       column === 'RiskPercent' ? 'Ryzyko %' : 
                       column === 'StartTime' ? 'Czas rozpoczęcia' :
                       column === 'EndTime' ? 'Czas zakończenia' :
                       column === 'HoldingTime' ? 'Czas (min)' :
                       column}
                    </label>
                  ))}
                </div>
              </details>
            </div>

            {/* Transactions Table */}
            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>                    {visibleColumns.Date && <th style={thStyle}>Data</th>}
                    {visibleColumns.Instrument && <th style={thStyle}>Instrument</th>}
                    {visibleColumns.Position && <th style={thStyle}>Pozycja</th>}
                    {visibleColumns.Strategy && <th style={thStyle}>Strategia</th>}
                    {visibleColumns.Timeframe && <th style={thStyle}>Timeframe</th>}
                    {visibleColumns.Session && <th style={thStyle}>Sesja</th>}
                    {visibleColumns.Quantity && <th style={thStyle}>Ilość</th>}
                    {visibleColumns.HoldingTime && <th style={thStyle}>Czas (min)</th>}
                    {visibleColumns.StartTime && <th style={thStyle}>Start</th>}
                    {visibleColumns.EndTime && <th style={thStyle}>Koniec</th>}
                    {visibleColumns.StopLoss && <th style={thStyle}>Stop Loss</th>}
                    {visibleColumns.AccountBalance && <th style={thStyle}>Saldo</th>}
                    {visibleColumns.RiskPercent && <th style={thStyle}>Ryzyko %</th>}
                    {visibleColumns.PnL && <th style={thStyle}>PnL</th>}
                    {visibleColumns.RFactor && <th style={thStyle}>R/Factor</th>}
                    {visibleColumns.Win && <th style={thStyle}>Win</th>}
                    {visibleColumns.Loss && <th style={thStyle}>Loss</th>}
                    {visibleColumns.Confidence && <th style={thStyle}>Confidence</th>}
                    {visibleColumns.PreNotes && <th style={thStyle}>Pre Notes</th>}
                    {visibleColumns.PostNotes && <th style={thStyle}>Post Notes</th>}
                    {visibleColumns.Actions && <th style={thStyle}>Akcje</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentTrades.map((trade, index) => (
                    <tr key={trade.id || index} style={{backgroundColor: index % 2 === 0 ? '#0a0a0a' : '#1a1a1a'}}>                      {visibleColumns.Date && (
                        <td style={tdStyle}>
                          {editingTradeId === trade.id ? (
                            <input 
                              type="date" 
                              value={editingTrade?.Date || ''}
                              onChange={(e) => setEditingTrade({...editingTrade, Date: e.target.value})}
                              style={{...inputStyle, fontSize: '0.7rem', padding: '0.25rem'}}
                            />
                          ) : (
                            trade.Date
                          )}
                        </td>
                      )}                      {visibleColumns.Instrument && (
                        <td style={tdStyle}>
                          {editingTradeId === trade.id ? (
                            <input 
                              type="text" 
                              value={editingTrade?.Coin || ''}
                              onChange={(e) => setEditingTrade({...editingTrade, Coin: e.target.value})}
                              style={{...inputStyle, fontSize: '0.7rem', padding: '0.25rem'}}
                            />
                          ) : (
                            trade.Coin
                          )}
                        </td>
                      )}                      {visibleColumns.Position && (
                        <td style={{...tdStyle, color: trade.Position === 'Long' ? '#2ecc71' : '#e74c3c'}}>
                          {editingTradeId === trade.id ? (
                            <select 
                              value={editingTrade?.Position || ''}
                              onChange={(e) => setEditingTrade({...editingTrade, Position: e.target.value})}
                              style={{...inputStyle, fontSize: '0.7rem', padding: '0.25rem'}}
                            >
                              <option value="Long">Long</option>
                              <option value="Short">Short</option>
                            </select>
                          ) : (
                            trade.Position
                          )}
                        </td>
                      )}{visibleColumns.Strategy && <td style={tdStyle}>{trade.Strategy}</td>}
                      {visibleColumns.Timeframe && <td style={tdStyle}>{trade.Timeframe}</td>}
                      {visibleColumns.Session && <td style={tdStyle}>{trade.Session}</td>}
                      {visibleColumns.Quantity && <td style={tdStyle}>{trade.Quantity}</td>}
                      {visibleColumns.HoldingTime && <td style={tdStyle}>{trade.HoldingTime}</td>}
                      {visibleColumns.StartTime && <td style={tdStyle}>{trade.StartTime || '-'}</td>}
                      {visibleColumns.EndTime && <td style={tdStyle}>{trade.EndTime || '-'}</td>}
                      {visibleColumns.StopLoss && <td style={tdStyle}>{trade.StopLoss} PLN</td>}
                      {visibleColumns.AccountBalance && <td style={tdStyle}>{trade.AccountBalance} PLN</td>}
                      {visibleColumns.RiskPercent && <td style={tdStyle}>{trade.RiskPercent}%</td>}                      {visibleColumns.PnL && (
                        <td style={{...tdStyle, color: trade['PnL ']?.includes('+') ? '#2ecc71' : '#e74c3c', fontWeight: 'bold'}}>
                          {editingTradeId === trade.id ? (
                            <input 
                              type="text" 
                              value={editingTrade?.['PnL '] || ''}
                              onChange={(e) => setEditingTrade({...editingTrade, 'PnL ': e.target.value})}
                              style={{...inputStyle, fontSize: '0.7rem', padding: '0.25rem'}}
                            />
                          ) : (
                            trade['PnL ']
                          )}
                        </td>
                      )}
                      {visibleColumns.RFactor && (
                        <td style={{...tdStyle, color: parseFloat(trade['R/Factor']) >= 0 ? '#2ecc71' : '#e74c3c'}}>
                          {trade['R/Factor']}
                        </td>
                      )}
                      {visibleColumns.Win && (
                        <td style={{...tdStyle, color: trade.Win === 'Yes' ? '#2ecc71' : '#666666'}}>
                          {trade.Win === 'Yes' ? '✅' : '❌'}
                        </td>
                      )}
                      {visibleColumns.Loss && (
                        <td style={{...tdStyle, color: trade.Loss === 'Yes' ? '#e74c3c' : '#666666'}}>
                          {trade.Loss === 'Yes' ? '❌' : '✅'}
                        </td>
                      )}
                      {visibleColumns.Confidence && (
                        <td style={tdStyle}>
                          {'⭐'.repeat(parseInt(trade['Confidence 1-5']) || 0)}
                        </td>
                      )}                      {visibleColumns.PreNotes && (
                        <td style={{...tdStyle, maxWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word'}} title={trade['Pre Notes']}>
                          {trade['Pre Notes']}
                        </td>
                      )}
                      {visibleColumns.PostNotes && (
                        <td style={{...tdStyle, maxWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word'}} title={trade['Post Notes']}>
                          {trade['Post Notes']}
                        </td>
                      )}                      {visibleColumns.Actions && (
                        <td style={tdStyle}>
                          <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                            {editingTradeId === trade.id ? (
                              <>
                                <button 
                                  onClick={handleSaveEditedTrade}
                                  style={{...buttonStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: '#2ecc71'}}
                                  title="Zapisz zmiany"
                                >
                                  💾
                                </button>
                                <button 
                                  onClick={handleCancelEdit}
                                  style={{...buttonStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: '#e74c3c'}}
                                  title="Anuluj edycję"
                                >
                                  ❌
                                </button>
                              </>                            ) : (
                              <>
                                {trade.IsActive && (
                                  <button 
                                    onClick={() => handleOpenEndTradeModal(trade, startIndex + index)}
                                    style={{...buttonStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: '#e67e22'}}
                                    title="Zakończ trade"
                                  >
                                    🏁
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleEditTrade(trade)}
                                  style={{...buttonStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: '#f39c12'}}
                                  title="Edytuj transakcję"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => handleDeleteTrade(startIndex + index)}
                                  style={{...buttonStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: '#e74c3c'}}
                                  title="Usuń transakcję"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination */}
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0', gap: '0.5rem'}}>
              <button 
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  ...buttonStyle, 
                  backgroundColor: currentPage === 1 ? '#555555' : '#3498db',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.75rem'
                }}
              >
                ⏮ Pierwsza
              </button>
              
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  ...buttonStyle, 
                  backgroundColor: currentPage === 1 ? '#555555' : '#3498db',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.75rem'
                }}
              >
                ◀ Poprzednia
              </button>
              
              <span style={{color: '#66ff99', fontWeight: '600', padding: '0 1rem'}}>
                {currentTrades.length > 0 ? `${startIndex + 1}-${Math.min(startIndex + tradesPerPage, trades.length)} z ${trades.length}` : 'Brak transakcji'}
              </span>
              
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{
                  ...buttonStyle, 
                  backgroundColor: currentPage === totalPages ? '#555555' : '#3498db',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.75rem'
                }}
              >
                Następna ▶
              </button>
              
              <button 
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{
                  ...buttonStyle, 
                  backgroundColor: currentPage === totalPages ? '#555555' : '#3498db',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.75rem'
                }}
              >
                Ostatnia ⏭
              </button>
            </div>

            {/* Animated Charts Section */}
            <h3 style={subHeadingStyle}>📊 Animowane Wykresy</h3>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', margin: '2rem 0'}}>
              
              {/* Daily PnL Line Chart */}
              <div style={chartContainerStyle}>
                <h4 style={{margin: '0 0 1rem 0', color: '#2c3e50', textAlign: 'center'}}>💹 Dzienny PnL</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={stats.dailyPnL}>
                    <defs>
                      <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3498db" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3498db" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f1"/>
                    <XAxis dataKey="formattedDate" stroke="#7f8c8d"/>
                    <YAxis stroke="#7f8c8d"/>
                    <Tooltip 
                      contentStyle={{backgroundColor: 'white', border: '1px solid #bdc3c7', borderRadius: '8px'}}
                      formatter={(value: any) => [`${value.toFixed(2)} PLN`, 'PnL']}
                    />
                    <Area type="monotone" dataKey="pnl" stroke="#3498db" fill="url(#colorPnL)" strokeWidth={3}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Win/Loss Pie Chart */}
              <div style={chartContainerStyle}>
                <h4 style={{margin: '0 0 1rem 0', color: '#2c3e50', textAlign: 'center'}}>🎯 Win/Loss Ratio</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Win', value: stats.winTrades, color: '#2ecc71' },
                        { name: 'Loss', value: stats.lossTrades, color: '#e74c3c' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      <Cell fill="#2ecc71"/>
                      <Cell fill="#e74c3c"/>
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value} transakcji`, '']}/>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Instruments Performance */}
              <div style={chartContainerStyle}>
                <h4 style={{margin: '0 0 1rem 0', color: '#2c3e50', textAlign: 'center'}}>🏆 Wydajność Instrumentów</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.coinStats?.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f1"/>
                    <XAxis dataKey="coin" stroke="#7f8c8d"/>
                    <YAxis stroke="#7f8c8d"/>
                    <Tooltip 
                      contentStyle={{backgroundColor: 'white', border: '1px solid #bdc3c7', borderRadius: '8px'}}
                      formatter={(value: any) => [`${value.toFixed(2)} PLN`, 'Total PnL']}
                    />
                    <Bar dataKey="total" fill="#3498db" radius={[4, 4, 0, 0]} animationDuration={1000}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly PnL */}
              {stats.monthlyPnL?.length > 1 && (
                <div style={chartContainerStyle}>
                  <h4 style={{margin: '0 0 1rem 0', color: '#2c3e50', textAlign: 'center'}}>📅 Miesięczny PnL</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.monthlyPnL}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ecf0f1"/>
                      <XAxis dataKey="month" stroke="#7f8c8d"/>
                      <YAxis stroke="#7f8c8d"/>
                      <Tooltip 
                        contentStyle={{backgroundColor: 'white', border: '1px solid #bdc3c7', borderRadius: '8px'}}
                        formatter={(value: any) => [`${value.toFixed(2)} PLN`, 'PnL']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="pnl" 
                        stroke="#9b59b6" 
                        strokeWidth={3}
                        dot={{r: 6, fill: '#9b59b6'}}
                        activeDot={{r: 8, fill: '#8e44ad'}}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>                </div>
              )}
            </div>

            {/* Additional Analysis Charts */}
            <h3 style={subHeadingStyle}>📊 Dodatkowe Analizy</h3>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', margin: '2rem 0'}}>
              
              {/* Strategy Performance */}
              {stats.strategyStats?.length > 0 && (
                <div style={chartContainerStyle}>
                  <h4 style={{margin: '0 0 1rem 0', color: '#66ff99', textAlign: 'center'}}>📈 Wydajność Strategii</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.strategyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333"/>
                      <XAxis dataKey="strategy" stroke="#66ff99" fontSize={12}/>
                      <YAxis stroke="#66ff99"/>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #00ff88', borderRadius: '8px', color: '#66ff99'}}
                        formatter={(value: any) => [`${value.toFixed(2)} PLN`, 'Średni PnL']}
                      />
                      <Bar dataKey="avgPnL" fill="#00ff88" radius={[4, 4, 0, 0]} animationDuration={1000}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Timeframe Analysis */}
              {stats.timeframeStats?.length > 0 && (
                <div style={chartContainerStyle}>
                  <h4 style={{margin: '0 0 1rem 0', color: '#66ff99', textAlign: 'center'}}>⏰ Analiza Timeframe</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.timeframeStats}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="trades"
                        animationBegin={0}
                        animationDuration={800}
                      >
                        {stats.timeframeStats.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #00ff88', borderRadius: '8px', color: '#66ff99'}}
                        formatter={(value: any) => [`${value} transakcji`, '']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Session Performance */}
              {stats.sessionStats?.length > 0 && (
                <div style={chartContainerStyle}>
                  <h4 style={{margin: '0 0 1rem 0', color: '#66ff99', textAlign: 'center'}}>🌍 Wydajność Sesji</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.sessionStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333"/>
                      <XAxis dataKey="session" stroke="#66ff99"/>
                      <YAxis stroke="#66ff99"/>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #00ff88', borderRadius: '8px', color: '#66ff99'}}
                        formatter={(value: any) => [`${value.toFixed(2)} PLN`, 'Średni PnL']}
                      />
                      <Bar dataKey="avgPnL" fill="#33ff66" radius={[4, 4, 0, 0]} animationDuration={1000}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Position Type Analysis */}
              {stats.positionStats?.length > 0 && (
                <div style={chartContainerStyle}>
                  <h4 style={{margin: '0 0 1rem 0', color: '#66ff99', textAlign: 'center'}}>📊 Long vs Short</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.positionStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333"/>
                      <XAxis dataKey="position" stroke="#66ff99"/>
                      <YAxis stroke="#66ff99"/>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #00ff88', borderRadius: '8px', color: '#66ff99'}}
                        formatter={(value: any, name: any) => [
                          name === 'winRate' ? `${value.toFixed(1)}%` : `${value.toFixed(2)} PLN`,
                          name === 'winRate' ? 'Win Rate' : 'Średni PnL'
                        ]}
                      />
                      <Bar dataKey="avgPnL" fill="#00ff88" radius={[4, 4, 0, 0]} animationDuration={1000}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Confidence Level Analysis */}
              {stats.confidenceStats?.length > 0 && (
                <div style={chartContainerStyle}>
                  <h4 style={{margin: '0 0 1rem 0', color: '#66ff99', textAlign: 'center'}}>🎯 Analiza Confidence</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.confidenceStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333"/>
                      <XAxis dataKey="confidence" stroke="#66ff99"/>
                      <YAxis stroke="#66ff99"/>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #00ff88', borderRadius: '8px', color: '#66ff99'}}
                        formatter={(value: any) => [`${value.toFixed(1)}%`, 'Win Rate']}
                      />
                      <Line 
                        type="monotone" dataKey="winRate" stroke="#2ecc71" strokeWidth={3}
                        dot={{r: 6, fill: '#2ecc71'}}
                        activeDot={{r: 8, fill: '#27ae60'}}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>          </>
        )}

        {/* End Trade Modal */}
        {showEndTradeModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #00ff88',
              borderRadius: '12px',
              padding: '2rem',
              minWidth: '400px',
              maxWidth: '500px'
            }}>
              <h3 style={{color: '#00ff88', marginBottom: '1rem', textAlign: 'center'}}>
                🏁 Zakończ Trade
              </h3>
              
              {tradeToEnd && (
                <div style={{marginBottom: '1.5rem', color: '#66ff99'}}>
                  <p><strong>Instrument:</strong> {tradeToEnd.Coin}</p>
                  <p><strong>Pozycja:</strong> {tradeToEnd.Position}</p>
                  <p><strong>Czas rozpoczęcia:</strong> {tradeToEnd.StartTime || 'Nie podano'}</p>
                </div>
              )}

              <div style={{marginBottom: '1.5rem'}}>
                <label style={{...labelStyle, color: '#00ff88'}}>
                  Czas zakończenia:
                  <input 
                    type="time" 
                    value={endTradeTime}
                    onChange={(e) => setEndTradeTime(e.target.value)}
                    style={{...inputStyle, fontSize: '1rem'}}
                    autoFocus
                  />
                </label>
              </div>

              <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
                <button 
                  onClick={handleEndTrade}
                  style={{...buttonStyle, backgroundColor: '#2ecc71'}}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2ecc71'}
                >
                  ✅ Zakończ Trade
                </button>
                <button 
                  onClick={handleCancelEndTrade}
                  style={{...buttonStyle, backgroundColor: '#e74c3c'}}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
                >
                  ❌ Anuluj
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default TradeAnalysis;
