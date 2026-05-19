import './App.css'
import  { useState, useRef,useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Chart.js のコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const INGREDIENTS = [
  { id: 'ice', name: '氷', color: 'rgba(230, 245, 255, 0.7)' },
  { id: 'color', name: '色素', color: 'hsla(0, 100%, 70%, 0.80)' },
  { id: 'soda', name: '炭酸水', color: 'rgba(200, 240, 255, 0.9)' },
  { id: 'syrup', name: '液糖', color: 'rgba(255, 250, 200, 0.8)' },
];

function App() {

  const [items, setItems] = useState([
    { id: 'syrup', name: '液糖 (ニッコン フラクトM75C 500g)', price: 1000, constant: 500 },
    { id: 'soda', name: '炭酸水 (amazon 500mlx24)', price: 1425, constant: 12000 },
    { id: 'color', name: '食用色素 赤 (ホームメイド 5.5g)', price: 183, constant: 5.5 },
    { id: 'ice', name: '氷 (業務スーパー 純氷 2kg)', price: 204, constant: 2000 },
  ]);

  const [materials, setMaterials] = useState([
    { id: 'cup', name: 'プラカップ (台和 89径)', price: 912, constant: 50 },
    { id: 'lid', name: 'プラ蓋 (台和 89径)', price: 813, constant: 100 },
    { id: 'straw', name: 'ストロー (フレックスストローKS)', price: 571, constant: 500 },
  ]);

  // 2. その他の設定データ（単独で入力するもの）
  const [settings, setSettings] = useState({
    freezerRental: 34800,
  });

  // 表の入力が変更されたときの処理
  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: Number(value) } : item
    ));
  };

  const handleMaterialChange = (id, field, value) => {
    setMaterials(materials.map(item => 
      item.id === id ? { ...item, [field]: Number(value) } : item
    ));
  };

  // その他の設定が変更されたときの処理
  const handleSettingChange = (field, value) => {
    setSettings({ ...settings, [field]: Number(value) });
  };


  const [points, setPoints] = useState([20, 40, 70]); // 初期値 (パーセンテージ)
  
  // ドラッグ操作の状態
  const draggingPointIndex = useRef(null);
  const containerRef = useRef(null);

  // ポイントから各材料の比率を計算する
  const calculateRatios = useCallback((currentPoints) => {
    const ratios = [];
    ratios.push(currentPoints[0]); // 氷
    ratios.push(currentPoints[1] - currentPoints[0]); // 色素
    ratios.push(currentPoints[2] - currentPoints[1]); // 炭酸水
    ratios.push(100 - currentPoints[2]); // 液糖
    return ratios;
  }, []);

  const ratios = calculateRatios(points);

  // --- マウス/タッチイベントハンドラ ---
  
  const handleStartDrag = (index, e) => {
    e.stopPropagation(); // 重なりによる予期せぬ挙動を防止
    draggingPointIndex.current = index;
    
    // マウス/タッチ移動と終了イベントを追加
    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', handleStopDrag);
    document.addEventListener('touchmove', handleDragging);
    document.addEventListener('touchend', handleStopDrag);
  };

  const handleDragging = useCallback((e) => {
    if (draggingPointIndex.current === null) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // カップの上部からの位置をパーセンテージで計算
    let newYPercent = ((mouseY - containerRect.top) / containerRect.height) * 100;
    
    // 範囲制限（0%〜100%）
    newYPercent = Math.max(0, Math.min(100, newYPercent));
    
    // 隣接するポイントを超えないように制限
    const newPoints = [...points];
    const index = draggingPointIndex.current;
    const lowerBound = index === 0 ? 0 : points[index - 1] + 0.2; // 最小限の厚みを確保
    const upperBound = index === points.length - 1 ? 100 : points[index + 1] - 0.2;
    
    newYPercent = Math.max(lowerBound, Math.min(upperBound, newYPercent));
    newPoints[index] = newYPercent;
    
    setPoints(newPoints);
  }, [points]);

  const handleStopDrag = useCallback(() => {
    draggingPointIndex.current = null;
    document.removeEventListener('mousemove', handleDragging);
    document.removeEventListener('mouseup', handleStopDrag);
    document.removeEventListener('touchmove', handleDragging);
    document.removeEventListener('touchend', handleStopDrag);
  }, [handleDragging]);
  const [volume, setVolume] = useState(150);
  const [price, setPrice] = useState(150);

  const salesCountLabels = Array.from({ length: 2000 }, (_, i) => i * 1);

  // グラフに渡すデータセット
  const chartData = {
    labels: salesCountLabels,
    datasets: [
      {
        label: '売上額 (円)',
        data: salesCountLabels.map(cups => cups * price),
        borderColor: 'rgba(54, 162, 235, 1)',     // 青色
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderWidth: 1,
        tension: 0.1, // 線の丸み
      },
      {
        label: '総原価 [固定費+変動費] (円)',
        // 固定費(冷凍庫) ＋ (1杯の原価 × 杯数)
        data: salesCountLabels.map(cups => settings.freezerRental + materials[0].price*(Math.floor(cups/materials[0].constant)+1) + materials[1].price*(Math.floor(cups/materials[1].constant)+1) + materials[2].price*(Math.floor(cups/materials[2].constant)+1) + items[0].price*(Math.floor(cups*Math.round(volume*(ratios[3]/100))/items[0].constant)+1)+ items[1].price*(Math.floor(cups*Math.round(volume*(ratios[2]/100)/items[1].constant))+1)+ items[2].price*(Math.floor(cups*Math.round(volume*(ratios[1]/100))/items[2].constant)+1)+ items[3].price*(Math.floor(cups*Math.round(volume*(ratios[0]/100))/items[3].constant)+1)),
        borderColor: 'rgba(255, 99, 132, 1)',     // 赤色
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderWidth: 1,
        tension: 0.1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: '販売数に応じた売上・原価シミュレーション',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: '金額 (円)' }
      },
      x: {
        title: { display: true, text: '販売数 (杯)' }
      }
    }
  };

  return (
    <div>
      <h2 style={{margin:"0 auto", borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>ドリンク原価計算シミュレーター</h2>
    <div style={{display:"flex"}}>
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px'}}>
      {/* --- その他の設定セクション --- */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', color: '#555' }}>冷凍庫レンタル代 (円)</label>
          <input 
            type="number" 
            value={settings.freezerRental} 
            onChange={(e) => handleSettingChange('freezerRental', e.target.value)}
            style={{ padding: '8px', width: '120px', marginTop: '5px' }}
          />
        </div>
      </div>

      {/* --- 材料・資材テーブルセクション --- */}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <thead style={{ backgroundColor: '#f5f5f5' }}>
          <tr>
            <th style={thStyle}>材料品名</th>
            <th style={thStyle}>購入価格 (円)</th>
            <th style={thStyle}>重量 (g)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}>{item.name}</td>
              <td style={tdStyle}>
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                  style={inputStyle}
                />
              </td>
              <td style={tdStyle}>
                <input
                  type="number"
                  value={item.constant}
                  onChange={(e) => handleItemChange(item.id, 'constant', e.target.value)}
                  style={inputStyle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <thead style={{ backgroundColor: '#f5f5f5' }}>
          <tr>
            <th style={thStyle}>資材品名</th>
            <th style={thStyle}>購入価格 (円)</th>
            <th style={thStyle}>個数 (個)</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => (
            <tr key={material.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}>{material.name}</td>
              <td style={tdStyle}>
                <input
                  type="number"
                  value={material.price}
                  onChange={(e) => handleMaterialChange(material.id, 'price', e.target.value)}
                  style={inputStyle}
                />
              </td>
              <td style={tdStyle}>
                <input
                  type="number"
                  value={material.constant}
                  onChange={(e) => handleMaterialChange(material.id, 'constant', e.target.value)}
                  style={inputStyle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px'}}>
{/* --- 左パネル: ドリンク図 --- */}

      <div 
        ref={containerRef}
        style={{ 
          width: '200px', 
          height: '400px', 
          border: '3px solid #666', 
          borderTop: 'none',
          borderRadius: '0 0 20px 20px',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#fff',
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
          cursor: 'ns-resize' // 上下リサイズのカーソル
        }}
      >
        {/* カップ内部の液体層 */}
        {INGREDIENTS.map((ing, i) => (
          <div
            key={ing.id}
            style={{
              position: 'absolute',
              top: `${i === 0 ? 0 : points[i - 1]}%`,
              left: 0,
              width: '100%',
              height: `${ratios[i]}%`,
              backgroundColor: ing.color,
              transition: draggingPointIndex.current !== null ? 'none' : 'top 0.3s ease, height 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#333',
              fontSize: '14px',
              textShadow: '0 1px 2px rgba(255,255,255,0.8)'
            }}
          >
            {ing.name} ({Math.round(volume*(ratios[i]/100))}g)
          </div>
        ))}

        {/* 調整ハンドル（画像のデザインを反映） */}
        {points.map((p, i) => (
          <div
            key={i}
            onMouseDown={(e) => handleStartDrag(i, e)}
            onTouchStart={(e) => handleStartDrag(i, e)}
            style={{
              position: 'absolute',
              top: `${p}%`,
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100px', // ハンドルの横幅
              height: '6px', // ハンドルの縦幅
              backgroundColor: 'white',
              border: '2px solid #333',
              borderRadius: '6px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              cursor: 'grab',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: draggingPointIndex.current !== null ? 'none' : 'top 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <h3>売上・原価グラフ</h3>
        <div style={{ fontSize: '20px', fontWeight: 'bold', width: '80px' }}>
        {price} <span style={{fontSize: '12px'}}>円</span>
        <div>
          <input
          type="range"
          min="120"
          max="500"
          step="10"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          style={{
            width: '200px',
            height: '100%',
            margin: 0,
            cursor: 'pointer'
          }}
        />
        </div>
      </div>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '20px' }}>
      <div style={{ height: '400px', display: 'flex', justifyContent: 'center'}}>
        <input
          type="range"
          min="100"
          max="500"    // 最大値（例: 300ml）
          step="25"    // ★ここを追加！ 50刻みで動くようになります
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          orient="vertical"
          style={{
            WebkitAppearance: 'slider-vertical', // Reactのインラインスタイル用にキャメルケース
            width: '10px',
            height: '100%',
            margin: 0,
            cursor: 'pointer'
          }}
        />
      </div>
      
      <div style={{ fontSize: '20px', fontWeight: 'bold', width: '80px' }}>
        {volume} <span style={{fontSize: '12px'}}>grams</span>
      </div>
    </div>
    </div>
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

const thStyle = { padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' };
const tdStyle = { padding: '12px', verticalAlign: 'middle' };
const inputStyle = { padding: '8px', width: '100px', boxSizing: 'border-box' };

export default App
