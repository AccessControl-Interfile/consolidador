import { DataType, EsteiraSheet, GroupedColumnMapping } from '../types';
import { parseNumericValue } from './consolidator';

interface SynonymGroup {
  targetName: string;
  defaultType: DataType;
  keywords: string[];
}

const SYNONYM_GROUPS: SynonymGroup[] = [
  {
    targetName: 'ID do Cliente / Operação',
    defaultType: 'string',
    keywords: ['id', 'id_cliente', 'id_operacao', 'id_proposta', 'id_atendimento', 'codigo', 'codigo_cliente', 'cod_cliente', 'contrato', 'num_proposta', 'protocolo']
  },
  {
    targetName: 'Nome do Cliente',
    defaultType: 'string',
    keywords: ['nome', 'nome_cliente', 'cliente_nome', 'nome completo', 'nome do cliente', 'razao_social', 'nome_razao', 'cliente', 'pagador', 'sacado']
  },
  {
    targetName: 'CPF / CNPJ',
    defaultType: 'string',
    keywords: ['cpf', 'cnpj', 'cpf_cnpj', 'cpf/cnpj', 'documento', 'doc', 'cgc']
  },
  {
    targetName: 'Valor (R$)',
    defaultType: 'currency',
    keywords: ['valor', 'valor_solicitado', 'valor_contrato', 'valor_liberado', 'valor_duvidoso', 'valor_total', 'quantia', 'saldo', 'monto', 'limite']
  },
  {
    targetName: 'Data',
    defaultType: 'date',
    keywords: ['data', 'data_proposta', 'data_emissao', 'data_pagamento', 'data_contato', 'data_entrada', 'data_criacao', 'data_ocorrencia', 'dt_entrada']
  },
  {
    targetName: 'Status',
    defaultType: 'status',
    keywords: ['status', 'status_analise', 'status_documental', 'status_ted', 'status_atendimento', 'status_cobranca', 'situacao', 'etapa', 'fase']
  },
  {
    targetName: 'Responsável',
    defaultType: 'string',
    keywords: ['analista_responsavel', 'operador', 'gestor', 'atendente', 'responsavel', 'usuario', 'agente', 'analista']
  }
];

function normalizeHeaderString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function findMatchingTargetName(originalHeader: string): { targetName: string; dataType: DataType } | null {
  const norm = normalizeHeaderString(originalHeader);

  for (const group of SYNONYM_GROUPS) {
    for (const kw of group.keywords) {
      const normKw = normalizeHeaderString(kw);
      if (norm === normKw || norm.includes(normKw) || normKw.includes(norm)) {
        return { targetName: group.targetName, dataType: group.defaultType };
      }
    }
  }

  return null;
}

function inferDataTypeFromHeaderAndSample(header: string, sampleValues: any[]): DataType {
  const normHeader = normalizeHeaderString(header);
  if (normHeader.includes('valor') || normHeader.includes('preco') || normHeader.includes('saldo') || normHeader.includes('custo')) {
    return 'currency';
  }
  if (normHeader.includes('data') || normHeader.includes('date') || normHeader.includes('dt_')) {
    return 'date';
  }
  if (normHeader.includes('status') || normHeader.includes('situacao') || normHeader.includes('etapa')) {
    return 'status';
  }

  // Sample inspect
  const nonEmpties = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpties.length > 0) {
    const isNum = nonEmpties.every(v => {
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (!trimmed) return false;
        const parsed = parseNumericValue(trimmed);
        return typeof parsed === 'number' && !isNaN(parsed);
      }
      return false;
    });
    if (isNum) return 'number';
  }

  return 'string';
}

export function generateSmartColumnMappings(
  sheets: EsteiraSheet[],
  useSynonyms: boolean = false
): GroupedColumnMapping[] {
  const selectedSheets = sheets.filter(s => s.selected);
  if (selectedSheets.length === 0) return [];

  // Map of normalized key or targetColumnName -> GroupedColumnMapping
  const mappingMap = new Map<string, GroupedColumnMapping>();

  selectedSheets.forEach(sheet => {
    sheet.headers.forEach(originalHeader => {
      const trimmedHeader = originalHeader.trim();
      if (!trimmedHeader) return;

      let targetName = trimmedHeader;
      let dataType: DataType = 'string';

      if (useSynonyms) {
        const match = findMatchingTargetName(trimmedHeader);
        targetName = match ? match.targetName : trimmedHeader;
        dataType = match
          ? match.dataType
          : inferDataTypeFromHeaderAndSample(
              trimmedHeader,
              sheet.rawRows.slice(0, 10).map(r => r[originalHeader])
            );
      } else {
        dataType = inferDataTypeFromHeaderAndSample(
          trimmedHeader,
          sheet.rawRows.slice(0, 10).map(r => r[originalHeader])
        );
      }

      // Grouping key: case-insensitive match for exact headers if not using synonyms
      const key = useSynonyms ? targetName : trimmedHeader.toLowerCase();

      if (!mappingMap.has(key)) {
        mappingMap.set(key, {
          targetColumnName: targetName,
          dataType: dataType,
          sourceMappings: []
        });
      }

      const existingGroup = mappingMap.get(key)!;
      // Prevent duplicate mappings from the same sheet for the same header
      if (!existingGroup.sourceMappings.some(sm => sm.sheetName === sheet.name && sm.originalHeader === originalHeader)) {
        existingGroup.sourceMappings.push({
          sheetName: sheet.name,
          originalHeader: originalHeader,
          isIgnored: false
        });
      }
    });
  });

  return Array.from(mappingMap.values());
}
