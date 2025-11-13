import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import React, { useState, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, MessageSquare, Send, TrendingUp, BarChart3, AlertCircle, X, Bug } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function DataDashboard() {
  const [data, setData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [charts, setCharts] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const fileInputRef = useRef(null);

  const analyzeData = (parsedData, cols) => {
    if (!parsedData || parsedData.length === 0) return { charts: [], kpis: [] };

    const generatedCharts = [];
    const generatedKpis = [];
    const numericCols = [];
    const categoricalCols = [];
    const dateCols = [];

    cols.forEach(col => {
      const sample = parsedData.slice(0, 10).map(row => row[col]).filter(v => v != null && v !== '');
      
      if (sample.length === 0) return;

      const numericCount = sample.filter(v => !isNaN(v) && v !== '').length;
      const dateCount = sample.filter(v => !isNaN(Date.parse(v))).length;

      if (numericCount / sample.length > 0.8) {
        numericCols.push(col);
      } else if (dateCount / sample.length > 0.8) {
        dateCols.push(col);
      } else {
        categoricalCols.push(col);
      }
    });

    if (numericCols.length > 0) {
      numericCols.slice(0, 4).forEach(col => {
        const values = parsedData.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        generatedKpis.push({
          title: col,
          value: avg.toFixed(2),
          subtitle: 'Average',
          trend: '+12%',
          max: max.toFixed(2),
          min: min.toFixed(2)
        });
      });
    }

    generatedKpis.unshift({
      title: 'Total Records',
      value: parsedData.length.toString(),
      subtitle: 'Dataset Size',
      trend: '100%'
    });

    if (categoricalCols.length > 0 && numericCols.length > 0) {
      const catCol = categoricalCols[0];
      const numCol = numericCols[0];
      
      const grouped = {};
      parsedData.forEach(row => {
        const cat = row[catCol];
        const val = parseFloat(row[numCol]);
        if (cat && !isNaN(val)) {
          grouped[cat] = (grouped[cat] || 0) + val;
        }
      });

      const chartData = Object.entries(grouped)
        .slice(0, 10)
        .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

      generatedCharts.push({
        type: 'bar',
        title: `${numCol} by ${catCol}`,
        data: chartData,
        xKey: 'name',
        yKey: 'value'
      });
    }

    if (dateCols.length > 0 && numericCols.length > 0) {
      const dateCol = dateCols[0];
      const numCol = numericCols[0];
      
      const timeData = parsedData
        .filter(row => row[dateCol] && !isNaN(parseFloat(row[numCol])))
        .slice(0, 50)
        .map(row => ({
          date: new Date(row[dateCol]).toLocaleDateString(),
          value: parseFloat(row[numCol])
        }));

      if (timeData.length > 0) {
        generatedCharts.push({
          type: 'line',
          title: `${numCol} Trend Over Time`,
          data: timeData,
          xKey: 'date',
          yKey: 'value'
        });
      }
    }

    if (numericCols.length >= 2) {
      const areaData = parsedData.slice(0, 30).map((row, idx) => ({
        name: `Point ${idx + 1}`,
        value1: parseFloat(row[numericCols[0]]) || 0,
        value2: parseFloat(row[numericCols[1]]) || 0
      }));

      generatedCharts.push({
        type: 'area',
        title: `${numericCols[0]} vs ${numericCols[1]}`,
        data: areaData,
        keys: ['value1', 'value2']
      });
    }

    if (categoricalCols.length > 0) {
      const catCol = categoricalCols[0];
      const distribution = {};
      
      parsedData.forEach(row => {
        const cat = row[catCol];
        if (cat) {
          distribution[cat] = (distribution[cat] || 0) + 1;
        }
      });

      const pieData = Object.entries(distribution)
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));

      generatedCharts.push({
        type: 'pie',
        title: `Distribution of ${catCol}`,
        data: pieData
      });
    }

    if (numericCols.length >= 2) {
      const compData = parsedData.slice(0, 15).map((row, idx) => {
        const obj = { name: `Row ${idx + 1}` };
        numericCols.slice(0, 3).forEach(col => {
          obj[col] = parseFloat(row[col]) || 0;
        });
        return obj;
      });

      generatedCharts.push({
        type: 'multibar',
        title: 'Multi-Metric Analysis',
        data: compData,
        keys: numericCols.slice(0, 3)
      });
    }

    if (numericCols.length >= 2) {
      const stackData = parsedData.slice(0, 20).map((row, idx) => ({
        name: `P${idx + 1}`,
        [numericCols[0]]: parseFloat(row[numericCols[0]]) || 0,
        [numericCols[1]]: parseFloat(row[numericCols[1]]) || 0
      }));

      generatedCharts.push({
        type: 'stackedarea',
        title: 'Cumulative Comparison',
        data: stackData,
        keys: numericCols.slice(0, 2)
      });
    }

    return { charts: generatedCharts, kpis: generatedKpis };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (file.name.endsWith('.csv')) {
          Papa.parse(evt.target.result, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: (results) => {
              setData(results.data);
              const cols = Object.keys(results.data[0] || {});
              setHeaders(cols);
              const { charts: generatedCharts, kpis: generatedKpis } = analyzeData(results.data, cols);
              setCharts(generatedCharts);
              setKpis(generatedKpis);
              setIsLoading(false);
            }
          });
        } else {
          const workbook = XLSX.read(evt.target.result, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          setData(jsonData);
          const cols = Object.keys(jsonData[0] || {});
          setHeaders(cols);
          const { charts: generatedCharts, kpis: generatedKpis } = analyzeData(jsonData, cols);
          setCharts(generatedCharts);
          setKpis(generatedKpis);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        setIsLoading(false);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const exportToPDF = async () => {
    setIsLoading(true);
    try {
      const dashboard = document.getElementById('dashboard-content');
      const canvas = await html2canvas(dashboard, {
        scale: 2,
        backgroundColor: '#111827',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Insighta-Dashboard-${fileName}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
    setIsLoading(false);
  };

  const exportToPPT = async () => {
    setIsLoading(true);
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_WIDE';
      
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: '111827' };
      titleSlide.addText('Insighta Dashboard', {
        x: 1,
        y: 2,
        w: 10,
        h: 1,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF'
      });
      titleSlide.addText(fileName, {
        x: 1,
        y: 3,
        w: 10,
        h: 0.5,
        fontSize: 24,
        color: '14B8A6'
      });
      titleSlide.addText(`Generated: ${new Date().toLocaleDateString()}`, {
        x: 1,
        y: 3.7,
        w: 10,
        h: 0.3,
        fontSize: 14,
        color: '9CA3AF'
      });
      
      if (kpis.length > 0) {
        const kpiSlide = pptx.addSlide();
        kpiSlide.background = { color: '111827' };
        kpiSlide.addText('Key Performance Indicators', {
          x: 0.5,
          y: 0.5,
          fontSize: 28,
          bold: true,
          color: 'FFFFFF'
        });
        
        kpis.slice(0, 4).forEach((kpi, idx) => {
          const row = Math.floor(idx / 2);
          const col = idx % 2;
          kpiSlide.addText(kpi.title, {
            x: 0.5 + col * 5,
            y: 1.5 + row * 1.5,
            w: 4,
            h: 0.4,
            fontSize: 16,
            color: '9CA3AF'
          });
          kpiSlide.addText(kpi.value, {
            x: 0.5 + col * 5,
            y: 2 + row * 1.5,
            w: 4,
            h: 0.6,
            fontSize: 32,
            bold: true,
            color: '14B8A6'
          });
        });
      }
      
      for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        const chartSlide = pptx.addSlide();
        chartSlide.background = { color: '111827' };
        chartSlide.addText(chart.title, {
          x: 0.5,
          y: 0.5,
          fontSize: 24,
          bold: true,
          color: 'FFFFFF'
        });
        
        const chartElement = document.querySelectorAll('.recharts-responsive-container')[i];
        if (chartElement) {
          const canvas = await html2canvas(chartElement, {
            backgroundColor: '#1F2937',
            scale: 2
          });
          const imgData = canvas.toDataURL('image/png');
          chartSlide.addImage({
            data: imgData,
            x: 1,
            y: 1.5,
            w: 8,
            h: 4
          });
        }
      }
      
      const footerSlide = pptx.addSlide();
      footerSlide.background = { color: '111827' };
      footerSlide.addText('Created with Insighta', {
        x: 1,
        y: 2.5,
        w: 8,
        h: 0.5,
        fontSize: 32,
        bold: true,
        color: '14B8A6',
        align: 'center'
      });
      footerSlide.addText('Because your data deserves to talk back', {
        x: 1,
        y: 3.2,
        w: 8,
        h: 0.3,
        fontSize: 16,
        color: '9CA3AF',
        align: 'center'
      });
      
      await pptx.writeFile({ fileName: `Insighta-Dashboard-${fileName}-${new Date().toISOString().split('T')[0]}.pptx` });
    } catch (error) {
      console.error('Error exporting PPT:', error);
      alert('Failed to export PowerPoint. Please try again.');
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    if (!apiKey) {
      setShowApiKeyInput(true);
      return;
    }

    const userMessage = { role: 'user', content: userInput };
    setChatMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const dataContext = `
Dataset: ${fileName}
Total Rows: ${data?.length || 0}
Columns: ${headers.join(', ')}

Available Charts:
${charts.map(c => `- ${c.title}`).join('\n')}

Sample Data (first 3 rows):
${JSON.stringify(data?.slice(0, 3), null, 2)}
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `You are a data analysis assistant. Here's the dataset context:\n\n${dataContext}\n\nUser question: ${userInput}\n\n IMPORTANT: If the user asks you to create any kind of chart or visualization, you MUST respond with ONLY a JSON object and nothing else. No explanation, no text before or after. Just the raw JSON in this exact format:\n{"chartType": "bar", "title": "Chart Title", "data": [{"name": "Category1", "value": 123}, {"name": "Category2", "value": 456}]}\n\nSupported chart types: bar, line, pie, area\n\nIf the user is NOT asking for a chart, provide a helpful analysis of their data.`
            }
          ]
        })
      });

      const result = await response.json();
      let responseText = result.content[0].text;
      
      const jsonPattern = /\{[\s\S]*?"chartType"[\s\S]*?\}/;
      const jsonMatch = responseText.match(jsonPattern);
      
      if (jsonMatch) {
        try {
          let jsonStr = jsonMatch[0];
          jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          
          const chartSpec = JSON.parse(jsonStr);
          const chartType = chartSpec.chartType === 'histogram' ? 'bar' : chartSpec.chartType;
          
          setCharts(prev => [...prev, {
            type: chartType,
            title: chartSpec.title || 'New Chart',
            data: chartSpec.data || [],
            xKey: 'name',
            yKey: 'value'
          }]);
          
          responseText = `✅ Chart created successfully! I've added "${chartSpec.title}" to your dashboard. Scroll up to see it!`;
          
        } catch (e) {
          console.error('Error parsing chart JSON:', e);
          responseText = "I tried to create a chart but encountered an error parsing the data. Please try asking again with different details.";
        }
      }

      const assistantMessage = {
        role: 'assistant',
        content: responseText
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling Claude API:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const renderChart = (chart, idx) => {
    switch (chart.type) {
      case 'histogram':
      case 'bar':
        return (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">{chart.title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey={chart.xKey} stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Bar dataKey={chart.yKey} fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'line':
        return (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">{chart.title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey={chart.xKey} stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Line type="monotone" dataKey={chart.yKey} stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'area':
        return (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">{chart.title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Area type="monotone" dataKey="value1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                <Area type="monotone" dataKey="value2" stroke="#ec4899" fill="#ec4899" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        return (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">{chart.title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chart.data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chart.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'multibar':
        return (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">{chart.title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                {chart.keys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'stackedarea':
        return (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">{chart.title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                {chart.keys.map((key, i) => (
                  <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={COLORS[i]} fill={COLORS[i]} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 overflow-x-hidden">
      <div className="bg-gray-800 border-b border-gray-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
                  <path d="M12 5C7.58172 5 4 8.58172 4 12C4 15.4183 7.58172 19 12 19C16.4183 19 20 15.4183 20 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="18" cy="8" r="1.5" fill="white"/>
                  <circle cx="20" cy="12" r="1.5" fill="white"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Insighta</h1>
                <p className="text-gray-400 text-xs">Because your data deserves to talk back</p>
              </div>
            </div>
            <button
              onClick={() => setShowBugReport(true)}
              className="flex items-center gap-2 bg-gray-700 text-white px-3 py-2 text-sm rounded-lg hover:bg-gray-600 transition"
            >
              <Bug size={18} />
              Report Bug
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2">
            <AlertCircle size={16} className="text-yellow-500 flex-shrink-0" />
            <span className="text-yellow-200 text-xs sm:text-sm">Beta Version - Product in Testing Phase</span>
          </div>
        </div>
      </div>

      <div id="dashboard-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {!data && (
          <div className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 p-12 text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <Upload size={64} className="mx-auto text-teal-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-white">Upload Your Data</h2>
            <p className="text-gray-400 mb-6">Support for CSV and Excel files</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-teal-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-teal-700 transition"
            >
              Choose File
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{fileName}</h2>
                <p className="text-gray-400 text-sm">{data.length} rows × {headers.length} columns</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportToPDF}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-600 text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 18H17V16H7V18Z" fill="currentColor"/>
                    <path d="M17 14H7V12H17V14Z" fill="currentColor"/>
                    <path d="M7 10H11V8H7V10Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M6 2C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V9C21 5.13401 17.866 2 14 2H6ZM6 4H13V9H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V5C5 4.44772 5.44772 4 6 4ZM15 4.10002C16.6113 4.4271 17.9413 5.52906 18.584 7H15V4.10002Z" fill="currentColor"/>
                  </svg>
                  Export PDF
                </button>
                <button
                  onClick={exportToPPT}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition disabled:bg-gray-600 text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" fill="currentColor"/>
                  </svg>
                  Export PPT
                </button>
                <button
                  onClick={() => {
                    setData(null);
                    setCharts([]);
                    setKpis([]);
                    setChatMessages([]);
                    setFileName('');
                  }}
                  className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-600 transition text-sm"
                >
                  Upload New File
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {kpis.slice(0, 4).map((kpi, idx) => (
                <div key={idx} className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-lg border border-gray-700 shadow-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-gray-400 text-sm font-medium">{kpi.title}</h3>
                    <TrendingUp size={18} className="text-teal-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{kpi.value}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs">{kpi.subtitle}</span>
                    <span className="text-teal-400 text-xs font-semibold">{kpi.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {charts.map((chart, idx) => (
                <div key={idx}>{renderChart(chart, idx)}</div>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="bg-gray-800 border-t border-gray-700 py-6 sm:py-8 mt-12 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 mb-2 text-sm">Co-founders</p>
          <p className="text-white font-semibold mb-4 text-sm sm:text-base">
            Nikhil Upadhyay • Prasanna Syam Shreyas Nair
          </p>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 max-w-2xl mx-auto mb-4">
            <p className="text-red-400 font-semibold mb-2 text-sm sm:text-base">🔍 We are actively looking for job opportunities!</p>
            <div className="text-red-300 text-xs sm:text-sm space-y-1">
              <p>📧 <a href="mailto:Nikhil25000@gmail.com" className="underline hover:text-red-200 break-all">Nikhil25000@gmail.com</a></p>
              <p>📧 <a href="mailto:shreyasnair1998@gmail.com" className="underline hover:text-red-200 break-all">shreyasnair1998@gmail.com</a></p>
            </div>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm">📍 Dublin, Ireland</p>
        </div>
      </footer>

      {data && (
        <button
          onClick={() => setShowChat(!showChat)}
          className="fixed bottom-6 right-6 bg-teal-600 text-white p-4 rounded-full shadow-lg hover:bg-teal-700 transition z-50"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {showChat && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 max-w-md h-[70vh] sm:h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-50">
          <div className="bg-teal-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="#14b8a6" strokeWidth="2"/>
                  <circle cx="18" cy="8" r="1.5" fill="#14b8a6"/>
                </svg>
              </div>
              <h3 className="font-semibold">Insighta AI Assistant</h3>
            </div>
            <button onClick={() => setShowChat(false)}>
              <X size={20} />
            </button>
          </div>
          
          {!apiKey ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-gray-900">
              <div className="text-center mb-6">
                <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500" />
                <h3 className="text-white font-semibold mb-2">API Key Required</h3>
                <p className="text-gray-400 text-sm mb-4">Enter your Anthropic API key to start chatting</p>
              </div>
              <input
                type="password"
                placeholder="sk-ant-..."
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="w-full bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 transition"
              >
                Save API Key
              </button>
              <p className="text-gray-500 text-xs mt-3 text-center">Get your key from console.anthropic.com</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageSquare size={48} className="mx-auto mb-4 text-gray-600" />
                    <p>Ask me anything about your data!</p>
                    <p className="text-sm mt-2">Try: "Create a chart showing..."</p>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-teal-600 ml-8'
                        : 'bg-gray-800 mr-8 border border-gray-700'
                    }`}
                  >
                    <p className="text-sm text-white">{msg.content}</p>
                  </div>
                ))}
                {isLoading && (
                  <div className="bg-gray-800 border border-gray-700 mr-8 p-3 rounded-lg">
                    <p className="text-sm text-gray-400">Thinking...</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-700 bg-gray-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about your data..."
                    className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    className="bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-700 transition disabled:bg-gray-600"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showBugReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Report a Bug</h3>
              <button onClick={() => setShowBugReport(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <p className="text-gray-300 mb-4">Found an issue? Let us know!</p>
            <a
              href="mailto:Nikhil250000@gmail.com?subject=Insighta Bug Report"
              className="block w-full bg-teal-600 text-white text-center py-3 rounded-lg font-semibold hover:bg-teal-700 transition"
            >
              Email: Nikhil250000@gmail.com
            </a>
          </div>
        </div>
      )}
    </div>
  );
}