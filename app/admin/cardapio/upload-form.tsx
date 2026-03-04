"use client";

import { useFormStatus } from "react-dom";
import { uploadMenuImageAction } from "./actions";

export function UploadMenuForm() {
  return (
    <form action={uploadMenuImageAction} className="mt-4 flex flex-col gap-3">
      <input
        type="file"
        name="menuImages"
        accept="image/jpeg,image/png,image/webp"
        multiple
        required
        className="block w-full text-sm"
      />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Enviando imagens..." : "Gerar rascunho"}
    </button>
  );
}

