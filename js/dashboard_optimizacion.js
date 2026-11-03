/**
 * ==============================================================================
 * DASHBOARD_OPTIMIZACION.JS
 * Suite Oficial de Dashboards Ejecutivos de Programación Académica y Evolución
 * Basado en los reportes TRILCE / DRA de los Excels institucionales.
 * Facultad de Ingeniería y Arquitectura (FIA) - UCV Virtual (SUBE a Distancia)
 * ==============================================================================
 */

(function(window) {
  // Datos analíticos procesados directamente desde los Excels oficiales:
  // - 7000003930_125602099_RptGralListaGruposDRA_20261007_104408.xlsx
  // - 7000003930_125560945_RptGralListaGruposDRA_20260908_180613 (3).xlsx
  // - 7000003930_125602086_RptIngMat_20261007_103821.xlsx
  const DEFAULT_DATA = {
    optimizacion: {
      sistemas: {
        secciones: 14,
        matriculas: 689,
        promedio: 49.2,
        pct_optimas: 85.7,
        pct_sub41: 14.3,
        distribucion: {
          '0 - 10': 0,
          '11 - 20': 1,
          '21 - 30': 1,
          '31 - 40': 0,
          '41 - 50': 4,
          '51 - 60': 7,
          'Más de 60': 1
        },
        ciclos: [
          { ciclo: 'Ciclo 1', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 2', sec: 5, mat: 288, prom: 57.6, pct_opt: 100.0, obs: 'Óptimo' },
          { ciclo: 'Ciclo 3', sec: 7, mat: 332, prom: 47.4, pct_opt: 85.7, obs: 'Óptimo' },
          { ciclo: 'Ciclo 4', sec: 2, mat: 69, prom: 34.5, pct_opt: 50.0, obs: 'Revisión' },
          { ciclo: 'Ciclo 5', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 6', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 7', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 8', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 9', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 10', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' }
        ]
      },
      industrial: {
        secciones: 0,
        matriculas: 0,
        promedio: 0.0,
        pct_optimas: 0.0,
        pct_sub41: 0.0,
        distribucion: {
          '0 - 10': 0,
          '11 - 20': 0,
          '21 - 30': 0,
          '31 - 40': 0,
          '41 - 50': 0,
          '51 - 60': 0,
          'Más de 60': 0
        },
        ciclos: [
          { ciclo: 'Ciclo 1', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 2', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 3', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 4', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 5', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 6', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 7', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 8', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 9', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' },
          { ciclo: 'Ciclo 10', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin datos' }
        ]
      },
      consolidado: {
        secciones: 73,
        matriculas: 3652,
        promedio: 50.0,
        pct_optimas: 72.6,
        pct_sub41: 27.4,
        distribucion: {
          '0 - 10': 1,
          '11 - 20': 6,
          '21 - 30': 5,
          '31 - 40': 8,
          '41 - 50': 4,
          '51 - 60': 40,
          'Más de 60': 9
        },
        ciclos: [
          { ciclo: 'Ciclo 1', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 2', sec: 21, mat: 1188, prom: 56.6, pct_opt: 90.5, obs: 'Óptimo' },
          { ciclo: 'Ciclo 3', sec: 27, mat: 1443, prom: 53.4, pct_opt: 81.5, obs: 'Óptimo' },
          { ciclo: 'Ciclo 4', sec: 15, mat: 654, prom: 43.6, pct_opt: 60.0, obs: 'Revisión' },
          { ciclo: 'Ciclo 5', sec: 7, mat: 285, prom: 40.7, pct_opt: 42.9, obs: 'Revisión' },
          { ciclo: 'Ciclo 6', sec: 3, mat: 82, prom: 27.3, pct_opt: 0.0, obs: 'Revisión' },
          { ciclo: 'Ciclo 7', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 8', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 9', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' },
          { ciclo: 'Ciclo 10', sec: 0, mat: 0, prom: 0, pct_opt: 0, obs: 'Sin grupos' }
        ]
      }
    },
    historico: {
      sistemas: {
        nombre: 'INGENIERÍA DE SISTEMAS',
        periodos: ['2024-I', '2024-II', '2025-I', '2025-II', '2026-I', '2026-II'],
        matriculas: [890, 980, 1120, 1240, 1320, 1432],
        ingresantes_2026_2: 174,
        edad_promedio: 34.8,
        genero: { M: 142, F: 32 },
        top_regiones: [
          { region: 'Lima', cant: 59 },
          { region: 'Piura', cant: 18 },
          { region: 'La Libertad', cant: 10 },
          { region: 'Puno', cant: 10 },
          { region: 'Lambayeque', cant: 8 }
        ],
        crecimiento_total: '+60.9%'
      },
      industrial: {
        nombre: 'INGENIERÍA INDUSTRIAL',
        periodos: ['2024-I', '2024-II', '2025-I', '2025-II', '2026-I', '2026-II'],
        matriculas: [0, 0, 0, 0, 0, 0],
        ingresantes_2026_2: 0,
        edad_promedio: 0.0,
        genero: { M: 0, F: 0 },
        top_regiones: [],
        crecimiento_total: '0.0%'
      },
      consolidado: {
        nombre: 'FACULTAD DE INGENIERÍA Y ARQUITECTURA',
        periodos: ['2024-I', '2024-II', '2025-I', '2025-II', '2026-I', '2026-II'],
        matriculas: [4340, 4800, 5330, 5920, 6310, 6571],
        ingresantes_2026_2: 659,
        edad_promedio: 33.6,
        genero: { M: 452, F: 207 },
        top_regiones: [
          { region: 'Lima', cant: 254 },
          { region: 'La Libertad', cant: 82 },
          { region: 'Piura', cant: 66 },
          { region: 'Arequipa', cant: 60 },
          { region: 'Lambayeque', cant: 40 }
        ],
        crecimiento_total: '+51.4%'
      }
    }
  };

  let dashData = DEFAULT_DATA;
  let chartDistribucionInstance = null;
  let chartTendenciaInstance = null;
  let activeEscuela = 'sistemas'; // 'sistemas', 'consolidado', 'industrial'

  // Plugin para pintar etiquetas numéricas y % sobre las barras del histograma
  const barValueLabelsPlugin = {
    id: 'barValueLabelsPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;

      meta.data.forEach((bar, index) => {
        const val = data.datasets[0].data[index];
        const pct = data.datasets[0].percentages ? data.datasets[0].percentages[index] : null;
        if (val > 0) {
          ctx.save();
          ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#0F172A';
          ctx.textAlign = 'center';
          const labelText = pct ? `${val} (${pct}%)` : `${val}`;
          ctx.fillText(labelText, bar.x, bar.y - 7);
          ctx.restore();
        }
      });
    }
  };

  // Plugin para pintar números sobre los puntos de la línea de tendencia
  const linePointLabelsPlugin = {
    id: 'linePointLabelsPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;

      meta.data.forEach((point, index) => {
        const val = data.datasets[0].data[index];
        ctx.save();
        ctx.font = 'bold 12px "Outfit", sans-serif';
        ctx.fillStyle = '#BE1E2D';
        ctx.textAlign = 'center';
        ctx.fillText(Number(val).toLocaleString('es-PE'), point.x, point.y - 12);
        ctx.restore();
      });
    }
  };

  /**
   * Carga datos desde la API si está disponible, o usa el fallback embebido
   */
  async function loadData() {
    try {
      let res = null;
      try {
        res = await fetch('api/dashboard_optimizacion.php');
      } catch (e) {}
      if (!res || !res.ok) {
        try {
          res = await fetch('/api/dashboard_optimizacion');
        } catch (e) {}
      }
      if (res && res.ok) {
        const json = await res.json();
        if (json && json.optimizacion && json.historico) {
          dashData = json;
        }
      }
    } catch (e) {
      // Usar DEFAULT_DATA silenciosamente
    }
  }

  /**
   * Actualiza el Dashboard 1: Optimización de la Programación Académica
   */
  function renderDashboardOptimizacion(escuelaKey = activeEscuela) {
    activeEscuela = escuelaKey;
    const opt = dashData.optimizacion[escuelaKey] || dashData.optimizacion.consolidado;

    // Actualizar Subtítulo según programa
    const subTitleEl = document.getElementById('suiteSubTitle');
    if (subTitleEl) {
      if (escuelaKey === 'sistemas') {
        subTitleEl.textContent = 'Pregrado a Distancia | Cursos de Especialidad (Teoría) • Escuela de Ingeniería de Sistemas';
      } else if (escuelaKey === 'industrial') {
        subTitleEl.textContent = 'Pregrado a Distancia | Cursos de Especialidad (Teoría) • Escuela de Ingeniería Industrial';
      } else {
        subTitleEl.textContent = 'Pregrado a Distancia | Cursos de Especialidad (Teoría) • Consolidado General (FIA)';
      }
    }

    // Mostrar/ocultar banner informativo de Industrial
    const bannerInd = document.getElementById('bannerAvisoIndustrial');
    if (bannerInd) {
      bannerInd.style.display = (escuelaKey === 'industrial') ? 'flex' : 'none';
    }

    // Actualizar KPIs
    const elSec = document.getElementById('kpiOptSecciones');
    const elMat = document.getElementById('kpiOptMatriculas');
    const elProm = document.getElementById('kpiOptPromedio');
    const elOpt = document.getElementById('kpiOptPctOptimas');
    const elSub = document.getElementById('kpiOptPctSub41');

    if (elSec) elSec.textContent = Number(opt.secciones).toLocaleString('es-PE');
    if (elMat) elMat.textContent = Number(opt.matriculas).toLocaleString('es-PE');
    if (elProm) elProm.textContent = Number(opt.promedio).toFixed(1);
    if (elOpt) elOpt.textContent = `${Number(opt.pct_optimas).toFixed(1)}%`;
    if (elSub) elSub.textContent = `${Number(opt.pct_sub41).toFixed(1)}%`;

    // Renderizar Gráfico de Distribución (Histograma)
    renderChartDistribucion(opt);

    // Renderizar Tabla por Ciclos
    renderTablaCiclos(opt.ciclos);
  }

  function renderChartDistribucion(opt) {
    const canvas = document.getElementById('chartDistribucionSecciones');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    if (chartDistribucionInstance) {
      chartDistribucionInstance.destroy();
    }

    const labels = Object.keys(opt.distribucion);
    const dataValues = Object.values(opt.distribucion);
    const total = opt.secciones || 1;
    const percentages = dataValues.map(v => (total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'));

    const maxVal = Math.max(...dataValues, 10);
    const yMax = Math.ceil((maxVal * 1.25) / 5) * 5;

    chartDistribucionInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Secciones',
          data: dataValues,
          percentages: percentages,
          backgroundColor: '#1A4B8C',
          hoverBackgroundColor: '#002855',
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.72
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 22, bottom: 0, left: 10, right: 10 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.raw} secciones (${percentages[c.dataIndex]}% del total)`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: yMax,
            grid: { color: '#E2E8F0', drawBorder: false },
            ticks: {
              color: '#64748B',
              font: { size: 11, family: 'Plus Jakarta Sans' },
              stepSize: Math.ceil(yMax / 6)
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#334155',
              font: { size: 11, weight: '600', family: 'Plus Jakarta Sans' }
            }
          }
        }
      },
      plugins: [barValueLabelsPlugin]
    });
  }

  function renderTablaCiclos(ciclos = []) {
    const tbody = document.getElementById('tbodyAsignacionCiclo');
    if (!tbody) return;

    tbody.innerHTML = ciclos.map(c => {
      let badgeClass = 'bg-secondary-subtle text-secondary';
      let icon = 'bi-dash-circle';
      if (c.obs === 'Óptimo') {
        badgeClass = 'badge-optimo-green';
        icon = 'bi-check-circle-fill';
      } else if (c.obs === 'Bueno') {
        badgeClass = 'badge-bueno-blue';
        icon = 'bi-hand-thumbs-up-fill';
      } else if (c.obs === 'Revisión') {
        badgeClass = 'badge-revision-amber';
        icon = 'bi-exclamation-triangle-fill';
      }

      return `
        <tr>
          <td class="fw-bold text-dark ps-3">${c.ciclo}</td>
          <td class="text-center fw-semibold text-secondary">${c.sec}</td>
          <td class="text-center fw-semibold text-dark">${Number(c.mat).toLocaleString('es-PE')}</td>
          <td class="text-center fw-bold text-primary">${c.prom > 0 ? c.prom.toFixed(1) : '0.0'}</td>
          <td class="text-center fw-bold ${c.pct_opt >= 70 ? 'text-success' : (c.pct_opt > 0 ? 'text-warning' : 'text-muted')}">
            ${c.sec > 0 ? c.pct_opt.toFixed(1) + '%' : '0.0%'}
          </td>
          <td class="text-center pe-3">
            <span class="badge ${badgeClass} px-2.5 py-1.5 fw-bold" style="font-size: 0.76rem; border-radius: 6px;">
              <i class="bi ${icon} me-1"></i>${c.obs}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Actualiza el Dashboard 2: Data Histórica (Evolución de Matrícula 2024 - 2026)
   */
  function renderDashboardHistorico(escuelaKey = activeEscuela) {
    activeEscuela = escuelaKey;
    const hist = dashData.historico[escuelaKey] || dashData.historico.consolidado;

    // Actualizar badge y textos del programa
    const elBadge = document.getElementById('badgeProgramaHistorico');
    if (elBadge) {
      elBadge.textContent = hist.nombre;
      if (escuelaKey === 'sistemas') {
        elBadge.style.backgroundColor = '#1D4ED8';
      } else if (escuelaKey === 'industrial') {
        elBadge.style.backgroundColor = '#059669';
      } else {
        elBadge.style.backgroundColor = '#BE1E2D';
      }
    }

    // Mini métricas
    const elIng = document.getElementById('histIngresantesCount');
    const elEdad = document.getElementById('histEdadPromedio');
    const elCrec = document.getElementById('histCrecimientoPct');
    const elReg = document.getElementById('histRegionesText');

    if (elIng) elIng.textContent = hist.ingresantes_2026_2;
    if (elEdad) elEdad.textContent = `${hist.edad_promedio} años`;
    if (elCrec) elCrec.textContent = hist.crecimiento_total;
    if (elReg) {
      if (hist.top_regiones && hist.top_regiones.length > 0) {
        elReg.textContent = hist.top_regiones.slice(0, 3).map(r => `${r.region} (${r.cant})`).join(' • ');
      } else {
        elReg.textContent = 'Sin datos registrados (0 alumnos)';
      }
    }

    // Renderizar gráfico de línea
    renderChartTendencia(hist);
  }

  function renderChartTendencia(hist) {
    const canvas = document.getElementById('chartTendenciaCrecimiento');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    if (chartTendenciaInstance) {
      chartTendenciaInstance.destroy();
    }

    // Crear gradiente de sombreado suave
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(190, 30, 45, 0.28)');
    gradient.addColorStop(1, 'rgba(190, 30, 45, 0.01)');

    const isAllZero = hist.matriculas.every(v => v === 0);
    const maxVal = isAllZero ? 10 : Math.max(...hist.matriculas, 2000);
    const yMax = isAllZero ? 10 : Math.ceil((maxVal * 1.2) / 500) * 500;

    chartTendenciaInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hist.periodos,
        datasets: [{
          label: 'Estudiantes Matriculados',
          data: hist.matriculas,
          borderColor: '#BE1E2D',
          borderWidth: 3.5,
          pointBackgroundColor: '#BE1E2D',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2.5,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          backgroundColor: gradient,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 25, bottom: 5, left: 10, right: 15 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            callbacks: {
              label: (c) => ` ${Number(c.raw).toLocaleString('es-PE')} matriculados`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            min: isAllZero ? 0 : Math.floor(Math.min(...hist.matriculas) * 0.7 / 100) * 100,
            max: yMax,
            grid: { color: '#F1F5F9' },
            ticks: {
              color: '#64748B',
              font: { size: 11, family: 'Plus Jakarta Sans' },
              stepSize: isAllZero ? 2 : undefined,
              callback: (val) => Number(val).toLocaleString('es-PE')
            }
          },
          x: {
            grid: { color: '#F8FAFC' },
            ticks: {
              color: '#1E293B',
              font: { size: 12, weight: '700', family: 'Plus Jakarta Sans' }
            }
          }
        }
      },
      plugins: [linePointLabelsPlugin]
    });
  }

  /**
   * Exporta el gráfico actual como imagen JPG
   */
  function exportarGraficoJPG() {
    const activeTab = document.querySelector('.dash-exec-tab-btn.active');
    const isHistorico = activeTab && activeTab.dataset.targetTab === 'tab-historico';
    const canvas = isHistorico
      ? document.getElementById('chartTendenciaCrecimiento')
      : document.getElementById('chartDistribucionSecciones');

    if (!canvas) {
      alert('No se encontró el gráfico para exportar.');
      return;
    }

    // Crear un canvas temporal con fondo blanco
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    const prog = activeEscuela.toUpperCase();
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Dashboard_${isHistorico ? 'Evolucion_Matricula' : 'Optimizacion_Teoria'}_${prog}_${dateStr}.jpg`;
    link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  /**
   * Dispara vista de impresión limpia para PDF
   */
  function exportarGraficoPDF() {
    window.print();
  }

  /**
   * Inicialización global de los componentes de Dashboard
   */
  async function init() {
    await loadData();

    // Detectar preferencia de DAC desde la sesión (Sistemas vs Industrial)
    try {
      const storedDac = (sessionStorage.getItem('sga_dac') || '').toLowerCase();
      if (storedDac === 'industrial') {
        activeEscuela = 'industrial';
      } else if (storedDac === 'sistemas') {
        activeEscuela = 'sistemas';
      }
    } catch (e) {
      // Ignorar si sessionStorage no está disponible
    }

    // Selectores de Escuela / Programa
    const selectOpt = document.getElementById('selectOptEscuela');
    if (selectOpt) {
      selectOpt.value = activeEscuela;
      selectOpt.addEventListener('change', (e) => {
        activeEscuela = e.target.value;
        const selectHist = document.getElementById('selectHistEscuela');
        if (selectHist) selectHist.value = activeEscuela;
        renderDashboardOptimizacion(activeEscuela);
        renderDashboardHistorico(activeEscuela);
      });
    }

    const selectHist = document.getElementById('selectHistEscuela');
    if (selectHist) {
      selectHist.value = activeEscuela;
      selectHist.addEventListener('change', (e) => {
        activeEscuela = e.target.value;
        const selectOptEl = document.getElementById('selectOptEscuela');
        if (selectOptEl) selectOptEl.value = activeEscuela;
        renderDashboardOptimizacion(activeEscuela);
        renderDashboardHistorico(activeEscuela);
      });
    }

    // Botones de pestañas del Suite
    const tabBtns = document.querySelectorAll('.dash-exec-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.targetTab;
        const tabContents = document.querySelectorAll('.dash-exec-tab-pane');
        tabContents.forEach(pane => {
          if (pane.id === target) {
            pane.classList.add('active', 'show');
            pane.style.display = 'block';
          } else {
            pane.classList.remove('active', 'show');
            pane.style.display = 'none';
          }
        });

        // Re-renderizar para ajustar tamaño del canvas
        setTimeout(() => {
          if (target === 'tab-optimizacion') {
            renderDashboardOptimizacion(activeEscuela);
          } else if (target === 'tab-historico') {
            renderDashboardHistorico(activeEscuela);
          }
        }, 60);
      });
    });

    // Botones de exportación
    const btnJpg = document.getElementById('btnExportDashJpg');
    if (btnJpg) btnJpg.addEventListener('click', exportarGraficoJPG);

    const btnPdf = document.getElementById('btnExportDashPdf');
    if (btnPdf) btnPdf.addEventListener('click', exportarGraficoPDF);

    // Render inicial
    renderDashboardOptimizacion(activeEscuela);
    renderDashboardHistorico(activeEscuela);
  }

  // Exponer al scope global
  window.DashboardOptimizacionSuite = {
    init,
    renderDashboardOptimizacion,
    renderDashboardHistorico,
    exportarGraficoJPG,
    exportarGraficoPDF,
    getData: () => dashData
  };

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
