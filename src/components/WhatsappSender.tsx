"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

type Contato = {
  nome: string;
  numero: string;
  mensagem: string;
  data?: string;
  diasSemVisita?: number;
  status?: "pendente" | "enviando" | "enviado" | "erro";
  erro?: string;
};

type WhatsappInstanceStatus =
  | "created"
  | "connecting"
  | "connected"
  | "disconnected"
  | "closed"
  | "error";

type WhatsappInstanceView = {
  id: string;
  instanceName: string;
  phoneNumber?: string;
  status: WhatsappInstanceStatus;
  qrCode?: string;
  connectedAt?: string;
  disconnectedAt?: string;
};

type WhatsappSenderProps = {
  initialInstance?: WhatsappInstanceView | null;
};

type ConnectionResponse = {
  success: boolean;
  instance?: WhatsappInstanceView | null;
  error?: unknown;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizarChave(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function pegarValorDaLinha(row: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = keys.map(normalizarChave);

  for (const [key, value] of Object.entries(row)) {
    if (normalizedKeys.includes(normalizarChave(key))) {
      return value;
    }
  }

  return undefined;
}

function parseExcelDate(value: unknown) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsedDate = XLSX.SSF.parse_date_code(value);

    if (!parsedDate) return null;

    return new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d);
  }

  const textValue = String(value).trim();

  if (!textValue) return null;

  const brazilianDateMatch = textValue.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (brazilianDateMatch) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] =
      brazilianDateMatch;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  const parsedDate = new Date(textValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function calcularDiasDesde(data: unknown) {
  const parsedDate = parseExcelDate(data);

  if (!parsedDate) return undefined;

  const start = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const differenceInMs = today.getTime() - start.getTime();

  return Math.max(0, Math.floor(differenceInMs / 86_400_000));
}

function montarMensagemFinal(contato: Contato) {
  const diasSemVisita = String(contato.diasSemVisita ?? "");

  return contato.mensagem
    .replaceAll("[Nome]", contato.nome)
    .replaceAll("[nome]", contato.nome)
    .replaceAll("[data]", diasSemVisita)
    .replaceAll("[Data]", diasSemVisita)
    .replaceAll("[dias]", diasSemVisita)
    .replaceAll("[Dias]", diasSemVisita)
    .replaceAll("[x]", diasSemVisita)
    .replaceAll("[X]", diasSemVisita);
}

function findStringByKey(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const value = findStringByKey(item, keys);

      if (value) return value;
    }

    return null;
  }

  for (const [key, value] of Object.entries(data)) {
    if (keys.includes(key) && typeof value === "string" && value.trim()) {
      return value;
    }

    const nestedValue = findStringByKey(value, keys);

    if (nestedValue) return nestedValue;
  }

  return null;
}

function normalizeQrImage(value: unknown) {
  if (typeof value !== "string") return null;

  const sanitizedValue = value.trim();

  if (sanitizedValue.startsWith("data:image/")) {
    return sanitizedValue;
  }

  if (sanitizedValue.includes("base64,")) {
    return `data:image/png;base64,${sanitizedValue.split("base64,").at(-1)}`;
  }

  if (sanitizedValue.length > 300 && !sanitizedValue.includes(" ")) {
    return `data:image/png;base64,${sanitizedValue}`;
  }

  return null;
}

function getQrDetails(data: unknown) {
  const imageValue = findStringByKey(data, [
    "base64",
    "base64Qr",
    "base64QRCode",
    "qrCodeBase64",
    "qrcodeBase64",
    "qrcode",
    "qrCode",
  ]);
  const codeValue = findStringByKey(data, ["code", "pairingCode"]);

  return {
    image: normalizeQrImage(imageValue),
    code: codeValue,
  };
}

function getStatusLabel(status?: WhatsappInstanceStatus) {
  if (status === "connected") return "WhatsApp conectado";
  if (status === "connecting" || status === "created") return "Aguardando conexao";
  if (status === "closed" || status === "disconnected") return "WhatsApp desconectado";
  if (status === "error") return "Erro na conexao";

  return "Nenhum WhatsApp conectado";
}

export function WhatsappSender({ initialInstance }: WhatsappSenderProps) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [instance, setInstance] = useState<WhatsappInstanceView | null>(
    initialInstance ?? null
  );
  const [connectionError, setConnectionError] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const qrDetails = getQrDetails(
    instance?.qrCode ? { base64: instance.qrCode } : null
  );
  const isConnected = instance?.status === "connected";
  const canSendMessages = Boolean(instance && isConnected);

  useEffect(() => {
    if (!instance || isConnected) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/whatsapp/instance");
        const data = (await response.json()) as ConnectionResponse;

        if (response.ok && data.success) {
          setInstance(data.instance ?? null);

          if (data.instance?.status === "connected") {
            setIsQrModalOpen(false);
          }
        }
      } catch {
        // The next interval will retry.
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [instance, isConnected]);

  function normalizarNumero(numero: string) {
    const apenasNumeros = String(numero).replace(/\D/g, "");

    if (apenasNumeros.startsWith("55")) {
      return apenasNumeros;
    }

    return `55${apenasNumeros}`;
  }

  function importarExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const contatosFormatados: Contato[] = rows.map((row) => {
        const nome = String(pegarValorDaLinha(row, ["nome"]) || "").trim();
        const numero = normalizarNumero(
          String(pegarValorDaLinha(row, ["numero", "telefone"]) || "")
        );
        const mensagem = String(pegarValorDaLinha(row, ["mensagem"]) || "").trim();
        const data = pegarValorDaLinha(row, [
          "data",
          "data ultima visita",
          "data última visita",
          "dataUltimaVisita",
          "ultimaVisita",
          "ultima visita",
          "última visita",
          "ultimoServico",
          "ultimo servico",
          "último serviço",
        ]);
        const diasSemVisita = calcularDiasDesde(data);

        return {
          nome,
          numero,
          mensagem,
          data: data ? String(data) : undefined,
          diasSemVisita,
          status: "pendente",
        };
      });

      setContatos(contatosFormatados);
    };

    reader.readAsArrayBuffer(file);
  }

  async function enviarMensagens() {
    if (!canSendMessages) return;

    setEnviando(true);

    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];
      const mensagemFinal = montarMensagemFinal(contato);

      setContatos((prev) =>
        prev.map((item, index) =>
          index === i ? { ...item, status: "enviando" } : item
        )
      );

      try {
        const response = await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: contato.numero,
            text: mensagemFinal,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(JSON.stringify(data.error));
        }

        setContatos((prev) =>
          prev.map((item, index) =>
            index === i ? { ...item, status: "enviado" } : item
          )
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Erro inesperado no envio.";

        setContatos((prev) =>
          prev.map((item, index) =>
            index === i
              ? {
                ...item,
                status: "erro",
                erro: message,
              }
              : item
          )
        );
      }

      await sleep(5000);
    }

    setEnviando(false);
  }

  async function conectarWhatsapp() {
    setConectando(true);
    setConnectionError("");

    try {
      const response = await fetch("/api/whatsapp/connect", {
        method: "POST",
      });
      const data = (await response.json()) as ConnectionResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Erro ao conectar WhatsApp.")
        );
      }

      setInstance(data.instance ?? null);
      setIsQrModalOpen(Boolean(data.instance?.qrCode && data.instance.status !== "connected"));
    } catch (error: unknown) {
      setConnectionError(
        error instanceof Error ? error.message : "Erro ao conectar WhatsApp."
      );
    } finally {
      setConectando(false);
    }
  }

  async function desconectarWhatsapp() {
    setDesconectando(true);
    setConnectionError("");

    try {
      const response = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
      });
      const data = (await response.json()) as ConnectionResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Erro ao desconectar WhatsApp.")
        );
      }

      setInstance(null);
      setIsQrModalOpen(false);
    } catch (error: unknown) {
      setConnectionError(
        error instanceof Error ? error.message : "Erro ao desconectar WhatsApp."
      );
    } finally {
      setDesconectando(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Conexao do WhatsApp
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {instance
                ? `${getStatusLabel(instance.status)} - ${instance.instanceName}`
                : "Conecte o WhatsApp para enviar mensagens."}
            </p>
            {instance?.phoneNumber && (
              <p className="mt-1 text-sm text-slate-600">
                Numero: {instance.phoneNumber}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!isConnected && (
              <button
                type="button"
                onClick={conectarWhatsapp}
                disabled={conectando || enviando}
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {conectando
                  ? "Conectando..."
                  : instance
                    ? "Reconectar WhatsApp"
                    : "Conectar WhatsApp"}
              </button>
            )}

            {instance && (
              <button
                type="button"
                onClick={desconectarWhatsapp}
                disabled={desconectando || enviando}
                className="h-10 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {desconectando ? "Desconectando..." : "Desconectar WhatsApp"}
              </button>
            )}
          </div>
        </div>

        {connectionError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {connectionError}
          </p>
        )}

        {!isConnected && (qrDetails.image || qrDetails.code) && (
          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="mt-4 h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          >
            Ver QR Code
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="spreadsheet"
          className="mb-3 block text-sm font-medium text-slate-700"
        >
          Planilha de contatos
        </label>
        <input
          id="spreadsheet"
          type="file"
          placeholder="Planilha de contatos"
          accept=".xlsx,.xls"
          onChange={importarExcel}
          disabled={enviando}
          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800 disabled:opacity-60"
        />
      </div>

      {contatos.length > 0 && (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{contatos.length}</span>{" "}
              contato(s) carregado(s)
            </p>

            <button
              onClick={enviarMensagens}
              disabled={enviando || !canSendMessages}
              className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? "Enviando..." : "Enviar mensagens"}
            </button>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="p-3 text-left font-semibold">Nome</th>
                  <th className="p-3 text-left font-semibold">Numero</th>
                  <th className="p-3 text-left font-semibold">Mensagem final</th>
                  <th className="p-3 text-left font-semibold">Status</th>
                </tr>
              </thead>

              <tbody>
                {contatos.map((contato, index) => (
                  <tr
                    key={`${contato.numero}-${index}`}
                    className="border-b border-slate-100"
                  >
                    <td className="p-3 text-slate-950">{contato.nome}</td>
                    <td className="p-3 text-slate-700">{contato.numero}</td>
                    <td className="p-3 text-slate-700">
                      {montarMensagemFinal(contato)}
                    </td>
                    <td className="p-3 text-slate-700">
                      {contato.status}
                      {contato.erro && (
                        <div className="mt-1 text-xs text-red-600">{contato.erro}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isQrModalOpen && (qrDetails.image || qrDetails.code) && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="qr-modal-title" className="text-lg font-semibold text-slate-950">
                  Conectar WhatsApp
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Leia o QR Code no celular.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="grid size-9 place-items-center rounded-md border border-slate-200 text-lg leading-none text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                aria-label="Fechar modal"
              >
                x
              </button>
            </div>

            {qrDetails.image && (
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <Image
                  src={qrDetails.image}
                  alt="QR Code para conectar o WhatsApp"
                  width={320}
                  height={320}
                  unoptimized
                  className="aspect-square w-full object-contain"
                />
              </div>
            )}

            {qrDetails.code && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-white">
                {qrDetails.code}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
