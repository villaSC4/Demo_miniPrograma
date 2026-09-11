/**
 * ==============================================================================
 * PARSER.JS - Módulo de Lectura y Detección de Archivos Excel (.xlsx, .xls)
 * Soporte Dual: Reporte General de Grupos y Reporte Ejecutivo Modular
 * ==============================================================================
 */

const ExcelParser = (() => {

  /**
   * Determina el módulo mensual a partir de la fecha de inicio
   */
  function getModuloFromDate(dateStr) {
    if (!dateStr) return 'Set';
    const s = String(dateStr).trim();
    if (s.includes('09-2026') || s.includes('-09-')) return 'Set';
    if (s.includes('10-2026') || s.includes('-10-')) return 'Oct';
    if (s.includes('11-2026') || s.includes('-11-')) return 'Nov';
    if (s.includes('12-2026') || s.includes('-12-')) return 'Dic';
    return 'Set';
  }

  /**
   * Lee un archivo Excel en ArrayBuffer y detecta automáticamente su estructura
   */
  function parseWorkbook(arrayBuffer, fileName) {
    if (typeof XLSX === 'undefined') {
      throw new Error('La librería SheetJS no se encuentra disponible.');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('El archivo Excel no contiene hojas de cálculo.');
    }

    let allGroups = [];
    let detectedType = 'general';
    let processedSheets = 0;

    for (const sheetName of workbook.SheetNames) {
      const lower = sheetName.toLowerCase();
      if (lower.includes('instrucc') || lower.includes('guia') || lower.includes('readme') || lower.includes('valores')) {
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rawRows || rawRows.length < 2) continue;

      let isExecutive = false;
      let headerIndex = -1;

      for (let r = 0; r < Math.min(6, rawRows.length); r++) {
        const rowText = (rawRows[r] || []).map(c => String(c || '').toLowerCase()).join(' ');
        if (rowText.includes('cursos asignados') && (rowText.includes('set') || rowText.includes('total'))) {
          isExecutive = true;
          headerIndex = r;
          break;
        } else if (rowText.includes('escuela') || rowText.includes('curso') || rowText.includes('experiencia') || rowText.includes('docente')) {
          headerIndex = r;
          break;
        }
      }

      if (headerIndex !== -1) {
        if (isExecutive) {
          const res = parseExecutiveReport(rawRows, headerIndex, `${fileName} [${sheetName}]`);
          allGroups = allGroups.concat(res.groups);
          detectedType = 'executive';
          processedSheets++;
        } else {
          const res = parseGeneralGroupsReport(rawRows, headerIndex, `${fileName} [${sheetName}]`);
          allGroups = allGroups.concat(res.groups);
          processedSheets++;
        }
      }
    }

    // Si no encontró cabeceras en el bucle anterior, usar la primera hoja por compatibilidad
    if (allGroups.length === 0) {
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      if (rawRows && rawRows.length >= 2) {
        const res = parseGeneralGroupsReport(rawRows, 0, fileName);
        allGroups = res.groups;
        processedSheets = 1;
      }
    }

    if (allGroups.length === 0) {
      throw new Error(`El archivo ${fileName} no contiene filas de programación académica válidas.`);
    }

    // Reasignar correlativos
    allGroups = allGroups.map((g, idx) => ({ ...g, id: idx }));

    return {
      fileName: fileName,
      type: detectedType,
      groups: allGroups,
      sheetsCount: processedSheets,
      summary: `${fileName}: ${allGroups.length} grupos cargados (${processedSheets} hoja/s procesada/s).`
    };
  }

  /**
   * Formato 1: Reporte General de Grupos Operativo
   */
  function parseGeneralGroupsReport(rows, headerIdx, fileName) {
    const rawHeaders = (rows[headerIdx] || []).map(h => String(h || '').trim().toLowerCase());

    const colMap = {
      escuela: rawHeaders.findIndex(h => h.includes('escuela') || h.includes('programa') || h.includes('carrera')),
      ciclo: rawHeaders.findIndex(h => h.includes('ciclo')),
      curso: rawHeaders.findIndex(h => h.includes('curso') || h.includes('experiencia') || h.includes('asignatura')),
      seccion: rawHeaders.findIndex(h => h.includes('secci') || h.includes('secc') || h.includes('grupo')),
      tipo_grupo: rawHeaders.findIndex(h => h.includes('tipo') || h.includes('modalidad')),
      matriculados: rawHeaders.findIndex(h => h.includes('matriculado') || h.includes('alumno') || h.includes('cant')),
      docente: rawHeaders.findIndex(h => h.includes('docente') || h.includes('profesor')),
      vbda: rawHeaders.findIndex(h => h.includes('vbda') || h.includes('vb da')),
      vbdg: rawHeaders.findIndex(h => h.includes('vbdg') || h.includes('vb dg')),
      aprobado: rawHeaders.findIndex(h => h.includes('aprobado') || h.includes('estado')),
      inicio: rawHeaders.findIndex(h => h.includes('inicio')),
      termino: rawHeaders.findIndex(h => h.includes('término') || h.includes('termino') || h.includes('fin'))
    };

    // Índices posicionales por defecto
    if (colMap.escuela === -1) colMap.escuela = 0;
    if (colMap.ciclo === -1) colMap.ciclo = 1;
    if (colMap.curso === -1) colMap.curso = 2;
    if (colMap.seccion === -1) colMap.seccion = 3;
    if (colMap.tipo_grupo === -1) colMap.tipo_grupo = 4;
    if (colMap.matriculados === -1) colMap.matriculados = 5;
    if (colMap.docente === -1) colMap.docente = 6;
    if (colMap.vbda === -1) colMap.vbda = 7;
    if (colMap.vbdg === -1) colMap.vbdg = 8;
    if (colMap.aprobado === -1) colMap.aprobado = 9;
    if (colMap.inicio === -1) colMap.inicio = 10;
    if (colMap.termino === -1) colMap.termino = 11;

    const parsed = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const cursoVal = String(row[colMap.curso] || '').trim();
      const escVal = String(row[colMap.escuela] || '').trim();
      if (!cursoVal && !escVal) continue;

      const inicioStr = String(row[colMap.inicio] || '').trim();

      parsed.push({
        id: parsed.length,
        escuela: escVal || 'GENERAL',
        ciclo: parseInt(row[colMap.ciclo]) || 0,
        curso: cursoVal || 'CURSO SIN NOMBRE',
        seccion: String(row[colMap.seccion] || '').trim(),
        tipo_grupo: String(row[colMap.tipo_grupo] || 'TEORIA').trim().toUpperCase(),
        matriculados: parseInt(row[colMap.matriculados]) || 0,
        docente: row[colMap.docente] ? String(row[colMap.docente]).trim() : '',
        vbda: String(row[colMap.vbda] || 'NO').trim().toUpperCase(),
        vbdg: String(row[colMap.vbdg] || 'NO').trim().toUpperCase(),
        aprobado: String(row[colMap.aprobado] || 'NO').trim().toUpperCase(),
        inicio: inicioStr,
        termino: String(row[colMap.termino] || '').trim(),
        modulo: getModuloFromDate(inicioStr)
      });
    }

    return {
      type: 'general',
      groups: parsed,
      fileName: fileName,
      summary: `Programación General: ${parsed.length} grupos cargados con éxito.`
    };
  }

  /**
   * Formato 2: Reporte Ejecutivo de Docentes y Módulos
   */
  function parseExecutiveReport(rows, headerIdx, fileName) {
    const generated = [];
    const monthDates = {
      Set: { inicio: '01-09-2026', termino: '03-10-2026' },
      Oct: { inicio: '04-10-2026', termino: '26-10-2026' },
      Nov: { inicio: '02-11-2026', termino: '05-12-2026' },
      Dic: { inicio: '06-12-2026', termino: '28-12-2026' }
    };

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const docName = String(row[1] || '').trim();
      if (!docName || docName.toUpperCase().includes('DOCENTE') || docName === 'IT') continue;

      const cursosStr = String(row[2] || 'Curso General').trim();
      const setCheck = String(row[3] || '').includes('✓') || String(row[3] || '').toUpperCase() === 'SI';
      const octCheck = String(row[4] || '').includes('✓') || String(row[4] || '').toUpperCase() === 'SI';
      const novCheck = String(row[5] || '').includes('✓') || String(row[5] || '').toUpperCase() === 'SI';
      const dicCheck = String(row[6] || '').includes('✓') || String(row[6] || '').toUpperCase() === 'SI';

      const mainCurso = cursosStr.split(';')[0].trim() || 'Curso General';
      const checks = { Set: setCheck, Oct: octCheck, Nov: novCheck, Dic: dicCheck };

      Object.keys(checks).forEach(m => {
        if (checks[m]) {
          generated.push({
            id: generated.length,
            escuela: 'GENERAL',
            ciclo: 3,
            curso: mainCurso,
            seccion: `M-${m}`,
            tipo_grupo: 'TEORIA',
            matriculados: 40,
            docente: docName,
            vbda: 'SI',
            vbdg: 'SI',
            aprobado: 'SI',
            inicio: monthDates[m].inicio,
            termino: monthDates[m].termino,
            modulo: m
          });
        }
      });
    }

    return {
      type: 'executive',
      groups: generated,
      fileName: fileName,
      summary: `Consolidado Ejecutivo: ${generated.length} módulos docentes activos sincronizados.`
    };
  }

  return {
    parseWorkbook,
    getModuloFromDate
  };

})();

if (typeof window !== 'undefined') window.ExcelParser = ExcelParser;
if (typeof globalThis !== 'undefined') globalThis.ExcelParser = ExcelParser;

