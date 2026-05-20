import './App.css'
import { useState, useRef, useCallback } from 'react';
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
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

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

  const [settings, setSettings] = useState({ freezerRental: 34800 });
  const [points, setPoints] = useState([20, 40, 70]);
  const [volume, setVolume] = useState(150);
  const [price, setPrice] = useState(150);
  const [cupRange, setCupRange] = useState([0, 300]);

  const draggingPointIndex = useRef(null);
  const containerRef = useRef(null);

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: Number(value) } : item));
  };

  const handleMaterialChange = (id, field, value) => {
    setMaterials(materials.map(item => item.id === id ? { ...item, [field]: Number(value) } : item)); // 元コードの typo 修正
  };

  const handleSettingChange = (field, value) => {
    setSettings({ ...settings, [field]: Number(value) });
  };

  const calculateRatios = useCallback((currentPoints) => {
    const ratios = [];
    ratios.push(currentPoints[0]); // 氷
    ratios.push(currentPoints[1] - currentPoints[0]); // 色素
    ratios.push(currentPoints[2] - currentPoints[1]); // 炭酸水
    ratios.push(100 - currentPoints[2]); // 液糖
    return ratios;
  }, []);

  const ratios = calculateRatios(points);

  // --- ドラッグ処理 ---
  const handleStartDrag = (index, e) => {
    e.stopPropagation();
    draggingPointIndex.current = index;
    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', handleStopDrag);
    document.addEventListener('touchmove', handleDragging);
    document.addEventListener('touchend', handleStopDrag);
  };

  const handleDragging = useCallback((e) => {
    if (draggingPointIndex.current === null) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseY = e.touches ? e.touches[0].clientY : e.clientY;
    let newYPercent = ((mouseY - containerRect.top) / containerRect.height) * 100;
    newYPercent = Math.max(0, Math.min(100, newYPercent));
    
    const newPoints = [...points];
    const index = draggingPointIndex.current;
    const lowerBound = index === 0 ? 0 : points[index - 1] + 0.2;
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

  // --- グラフデータの生成 (10杯刻みにして軽量化) ---
  const step = 1;
  const salesCountLabels = [];
  for (let i = cupRange[0]; i <= cupRange[1]; i += step) {
    salesCountLabels.push(i);
  }
  // 最大値がピッタリ入るように保証
  if (salesCountLabels[salesCountLabels.length - 1] !== cupRange[1]) {
    salesCountLabels.push(cupRange[1]);
  }

  // 1杯あたりの各材料のグラム数
  const icePerCup = Math.round(volume * (ratios[0] / 100));
  const colorPerCup = Math.round(volume * (ratios[1] / 100));
  const sodaPerCup = Math.round(volume * (ratios[2] / 100));
  const syrupPerCup = Math.round(volume * (ratios[3] / 100));

  const chartData = {
    labels: salesCountLabels,
    datasets: [
      {
        label: '売上額 (円)',
        data: salesCountLabels.map(cups => cups * price),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderWidth: 1,
        tension: 0.1,
      },
      {
        label: '総原価 [固定費+変動費] (円)',
        data: salesCountLabels.map(cups => {
          // 売上0の時は、固定費のみ（資材や材料は仕入れない）にする処理
          if (cups === 0) return settings.freezerRental;

          // 資材の必要パック数 (Math.ceilで適切に繰り上げ)
          const cupPack = Math.ceil(cups / materials[0].constant);
          const lidPack = Math.ceil(cups / materials[1].constant);
          const strawPack = Math.ceil(cups / materials[2].constant);

          // 原材料の必要パック数 (1杯あたりの量 × 杯数 から算出)
          const syrupPack = Math.ceil((cups * syrupPerCup) / items[0].constant);
          const sodaPack = Math.ceil((cups * sodaPerCup) / items[1].constant);
          const colorPack = Math.ceil((cups * colorPerCup) / items[2].constant);
          const icePack = Math.ceil((cups * icePerCup) / items[3].constant);

          // 合計金額の計算
          return (
            settings.freezerRental +
            (cupPack * materials[0].price) +
            (lidPack * materials[1].price) +
            (strawPack * materials[2].price) +
            (syrupPack * items[0].price) +
            (sodaPack * items[1].price) +
            (colorPack * items[2].price) +
            (icePack * items[3].price)
          );
        }),
        borderColor: 'rgba(255, 99, 132, 1)',
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
      title: { display: true, text: '販売数に応じた売上・原価シミュレーション' },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: '金額 (円)' } },
      x: { title: { display: true, text: '販売数 (杯)' } }
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 auto", borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>ドリンク原価計算シミュレーター</h2>
      <div style={{ display: "flex" }}>
        {/* テーブル側 */}
        <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#555' }}>冷凍庫レンタル代 (円)</label>
              <input type="number" value={settings.freezerRental} onChange={(e) => handleSettingChange('freezerRental', e.target.value)} style={{ padding: '8px', width: '120px', marginTop: '5px' }} />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', marginBottom: '20px' }}>
            <thead style={{ backgroundColor: '#f5f5f5' }}>
              <tr><th style={thStyle}>材料品名</th><th style={thStyle}>購入価格 (円)</th><th style={thStyle}>重量 (g)</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}><input type="number" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', e.target.value)} style={inputStyle} /></td>
                  <td style={tdStyle}><input type="number" value={item.constant} onChange={(e) => handleItemChange(item.id, 'constant', e.target.value)} style={inputStyle} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
            <thead style={{ backgroundColor: '#f5f5f5' }}>
              <tr><th style={thStyle}>資材品名</th><th style={thStyle}>購入価格 (円)</th><th style={thStyle}>個数 (個)</th></tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{material.name}</td>
                  <td style={tdStyle}><input type="number" value={material.price} onChange={(e) => handleMaterialChange(material.id, 'price', e.target.value)} style={inputStyle} /></td>
                  <td style={tdStyle}><input type="number" value={material.constant} onChange={(e) => handleMaterialChange(material.id, 'constant', e.target.value)} style={inputStyle} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ビジュアル・スライダー側 */}
        <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          <div ref={containerRef} style={{ width: '200px', height: '400px', border: '3px solid #666', borderTop: 'none', borderRadius: '0 0 20px 20px', position: 'relative', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', cursor: 'ns-resize' }}>
            {INGREDIENTS.map((ing, i) => (
              <div key={ing.id} style={{ position: 'absolute', top: `${i === 0 ? 0 : points[i - 1]}%`, left: 0, width: '100%', height: `${ratios[i]}%`, backgroundColor: ing.color, transition: draggingPointIndex.current !== null ? 'none' : 'top 0.3s ease, height 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#333', fontSize: '14px', textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
                {ing.name} ({Math.round(volume * (ratios[i] / 100))}g)
              </div>
            ))}
            {points.map((p, i) => (
              <div key={i} onMouseDown={(e) => handleStartDrag(i, e)} onTouchStart={(e) => handleStartDrag(i, e)} style={{ position: 'absolute', top: `${p}%`, left: '50%', transform: 'translate(-50%, -50%)', width: '100px', height: '6px', backgroundColor: 'white', border: '2px solid #333', borderRadius: '6px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', cursor: 'grab', zIndex: 10 }} />
            ))}
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>売上・原価グラフ</h3>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
              {price} <span style={{ fontSize: '12px' }}>円</span>
              <input type="range" min="120" max="500" step="10" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '200px', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        {/* 縦型ボリュームスライダー */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '20px' }}>
          <div style={{ height: '400px', display: 'flex', justifyContent: 'center' }}>
            <input orient="vertical" type="range" min="100" max="500" step="25" value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ WebkitAppearance: 'slider-vertical', width: '10px', height: '100%', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', width: '80px' }}>
            {volume} <span style={{ fontSize: '12px' }}>grams</span>
          </div>
        </div>
      </div>

      {/* rc-slider の配置（親divに横幅を指定して潰れないように改善） */}
      <div style={{ width: '800px', margin: '30px auto', textAlign: 'center' }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          {cupRange[0]} <span style={{ fontSize: '12px' }}>杯</span> - {cupRange[1]} <span style={{ fontSize: '12px' }}>杯</span>
        </div>
        <Slider range min={0} max={1600} step={50} value={cupRange} onChange={(value) => setCupRange(value)} />
      </div>

      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', margin: '0 auto' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

const thStyle = { padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' };
const tdStyle = { padding: '12px', verticalAlign: 'middle' };
const inputStyle = { padding: '8px', width: '100px', boxSizing: 'border-box' };

export default App;