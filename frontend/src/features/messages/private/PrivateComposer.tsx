import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiSend, type MessagePublic } from "../../../lib/api";
import { showToast } from "../../../components/ui/Toast";

type Props = {
  recipientId: number;
  onSent?: () => void;
};

export function PrivateComposer({ recipientId, onSent }: Props) {
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () =>
      apiSend<MessagePublic>("POST", "/messages", {
        recipient_id: recipientId,
        body: body.trim(),
      }),
    onSuccess: () => {
      setBody("");
      onSent?.();
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "No se pudo enviar", "error");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || send.isPending) return;
    send.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex gap-2 border-t border-border p-3"
      aria-label="Redactar mensaje privado"
    >
      <input
        className="flex-1 rounded-full border border-border bg-bg px-4 py-2 text-sm outline-none focus:border-primary"
        placeholder="Escribe un mensaje…"
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Mensaje privado"
      />
      <button
        type="submit"
        disabled={!body.trim() || send.isPending}
        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {send.isPending ? "…" : "Enviar"}
      </button>
    </form>
  );
}
