import * as XLSX from 'xlsx';
import { EsteiraSheet } from '../types';

export function createDemoSheets(): EsteiraSheet[] {
  // Esteira 01: Análise de Crédito
  const rawRows1 = [
    {
      "ID_Cliente": "CLI-1001",
      "Nome_Cliente": "Carlos Eduardo Silva",
      "CPF_CNPJ": "123.456.789-00",
      "Valor_Solicitado": 15000.00,
      "Data_Proposta": "2026-07-01",
      "Status_Analise": "Aprovado",
      "Analista_Responsavel": "Mariana Costa"
    },
    {
      "ID_Cliente": "CLI-1002",
      "Nome_Cliente": "Fernanda Oliveira Santos",
      "CPF_CNPJ": "234.567.890-11",
      "Valor_Solicitado": 28500.50,
      "Data_Proposta": "2026-07-02",
      "Status_Analise": "Em Análise",
      "Analista_Responsavel": "Mariana Costa"
    },
    {
      "ID_Cliente": "CLI-1003",
      "Nome_Cliente": "Roberto Alves Pereira",
      "CPF_CNPJ": "345.678.901-22",
      "Valor_Solicitado": 50000.00,
      "Data_Proposta": "2026-07-03",
      "Status_Analise": "Pendente Docs",
      "Analista_Responsavel": "Lucas Mendes"
    },
    {
      "ID_Cliente": "CLI-1004",
      "Nome_Cliente": "Beatriz Rodrigues Lima",
      "CPF_CNPJ": "456.789.012-33",
      "Valor_Solicitado": 8200.00,
      "Data_Proposta": "2026-07-05",
      "Status_Analise": "Recusado",
      "Analista_Responsavel": "Lucas Mendes"
    },
    {
      "ID_Cliente": "CLI-1005",
      "Nome_Cliente": "Tech Solutions Ltda",
      "CPF_CNPJ": "12.345.678/0001-90",
      "Valor_Solicitado": 120000.00,
      "Data_Proposta": "2026-07-06",
      "Status_Analise": "Aprovado",
      "Analista_Responsavel": "Mariana Costa"
    }
  ];

  // Esteira 02: Formalização e Contratos
  const rawRows2 = [
    {
      "ID_Operacao": "CLI-1001",
      "Cliente_Nome": "Carlos Eduardo Silva",
      "CPF": "123.456.789-00",
      "Valor_Contrato": 15000.00,
      "Data_Emissao": "02/07/2026",
      "Status_Documental": "Assinado",
      "Operador": "Amanda Souza"
    },
    {
      "ID_Operacao": "CLI-1005",
      "Cliente_Nome": "Tech Solutions Ltda",
      "CPF": "12.345.678/0001-90",
      "Valor_Contrato": 120000.00,
      "Data_Emissao": "07/07/2026",
      "Status_Documental": "Aguardando Assinatura",
      "Operador": "Amanda Souza"
    },
    {
      "ID_Operacao": "CLI-1006",
      "Cliente_Nome": "Juliana Martins Ribeiro",
      "CPF": "567.890.123-44",
      "Valor_Contrato": 35000.00,
      "Data_Emissao": "08/07/2026",
      "Status_Documental": "Assinado",
      "Operador": "Felipe Rocha"
    },
    {
      "ID_Operacao": "CLI-1007",
      "Cliente_Nome": "Marcos Vinicius Barbosa",
      "CPF": "678.901.234-55",
      "Valor_Contrato": 18900.00,
      "Data_Emissao": "09/07/2026",
      "Status_Documental": "Pendente CCB",
      "Operador": "Felipe Rocha"
    }
  ];

  // Esteira 03: Liberação e Pagamentos
  const rawRows3 = [
    {
      "ID_Proposta": "CLI-1001",
      "Nome Completo": "Carlos Eduardo Silva",
      "Documento": "123.456.789-00",
      "Valor_Liberado": 15000.00,
      "Data_Pagamento": "2026-07-03",
      "Status_TED": "Concluído",
      "Gestor": "Ricardo Almeida"
    },
    {
      "ID_Proposta": "CLI-1006",
      "Nome Completo": "Juliana Martins Ribeiro",
      "Documento": "567.890.123-44",
      "Valor_Liberado": 35000.00,
      "Data_Pagamento": "2026-07-10",
      "Status_TED": "Agendado",
      "Gestor": "Ricardo Almeida"
    },
    {
      "ID_Proposta": "CLI-1008",
      "Nome Completo": "Camila Fernandes Castro",
      "Documento": "789.012.345-66",
      "Valor_Liberado": 42000.00,
      "Data_Pagamento": "2026-07-12",
      "Status_TED": "Concluído",
      "Gestor": "Patricia Lima"
    }
  ];

  // Esteira 04: Atendimento e Suporte
  const rawRows4 = [
    {
      "ID_Atendimento": "CLI-1002",
      "Nome do Cliente": "Fernanda Oliveira Santos",
      "CPF_CNPJ": "234.567.890-11",
      "Valor_Duvidoso": 28500.50,
      "Data_Contato": "2026-07-04",
      "Status_Atendimento": "Dúvida Taxas Solucionada",
      "Atendente": "Gabriel Nogueira"
    },
    {
      "ID_Atendimento": "CLI-1003",
      "Nome do Cliente": "Roberto Alves Pereira",
      "CPF_CNPJ": "345.678.901-22",
      "Valor_Duvidoso": 50000.00,
      "Data_Contato": "2026-07-05",
      "Status_Atendimento": "Aguardando Comprovante Renda",
      "Atendente": "Gabriel Nogueira"
    },
    {
      "ID_Atendimento": "CLI-1009",
      "Nome do Cliente": "Glow Cosmetics ME",
      "CPF_CNPJ": "98.765.432/0001-10",
      "Valor_Duvidoso": 95000.00,
      "Data_Contato": "2026-07-11",
      "Status_Atendimento": "Análise Especializada",
      "Atendente": "Renata Viana"
    }
  ];

  return [
    {
      id: 'sheet-1',
      name: 'Esteira 01 - Análise Crédito',
      rowCount: rawRows1.length,
      columnCount: Object.keys(rawRows1[0]).length,
      headers: Object.keys(rawRows1[0]),
      rawRows: rawRows1,
      selected: true,
      emptyRowCount: 0,
      completenessRate: 100
    },
    {
      id: 'sheet-2',
      name: 'Esteira 02 - Formalização',
      rowCount: rawRows2.length,
      columnCount: Object.keys(rawRows2[0]).length,
      headers: Object.keys(rawRows2[0]),
      rawRows: rawRows2,
      selected: true,
      emptyRowCount: 0,
      completenessRate: 100
    },
    {
      id: 'sheet-3',
      name: 'Esteira 03 - Liberação Pagamentos',
      rowCount: rawRows3.length,
      columnCount: Object.keys(rawRows3[0]).length,
      headers: Object.keys(rawRows3[0]),
      rawRows: rawRows3,
      selected: true,
      emptyRowCount: 0,
      completenessRate: 100
    },
    {
      id: 'sheet-4',
      name: 'Esteira 04 - Atendimento Pós-Venda',
      rowCount: rawRows4.length,
      columnCount: Object.keys(rawRows4[0]).length,
      headers: Object.keys(rawRows4[0]),
      rawRows: rawRows4,
      selected: true,
      emptyRowCount: 0,
      completenessRate: 100
    }
  ];
}

/**
 * Downloads a generated sample .xlsx file for testing in external spreadsheet apps.
 */
export function generateDemoExcelFile(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const sheetsData = createDemoSheets();

  sheetsData.forEach((sheet) => {
    const ws = XLSX.utils.json_to_sheet(sheet.rawRows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
