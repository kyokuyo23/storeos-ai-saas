import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Panel, StoreMark } from "@/components/FoundationShell";

const MAX_LOGO_BYTES = 512_000;
const MAX_SIDE = 512;

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + 0x8000)));
  return btoa(binary);
};

/** Resize to ≤512 px; keep transparency (PNG/WebP), fall back to smaller encodings until ≤500 KB. */
async function prepareLogo(file: File): Promise<{ contentType: "image/png" | "image/webp" | "image/jpeg"; dataBase64: string }> {
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) throw new Error("Pilih file gambar PNG, JPG, atau WebP. SVG tidak didukung.");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("File gambar tidak dapat dibaca."); });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const attempts: Array<["image/png" | "image/webp" | "image/jpeg", number | undefined]> = [["image/png", undefined], ["image/webp", 0.9], ["image/webp", 0.75], ["image/jpeg", 0.8]];
  for (const [type, quality] of attempts) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob && blob.type === type && blob.size <= MAX_LOGO_BYTES) return { contentType: type, dataBase64: await toBase64(blob) };
  }
  throw new Error("Logo terlalu besar. Gunakan gambar yang lebih sederhana.");
}

/** Settings panel: upload, replace or remove the store logo (owner and admin sistem). */
export function StoreLogoSettings() {
  const utils = trpc.useUtils();
  const branding = trpc.settings.branding.useQuery();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const done = (message: string) => { toast.success(message); utils.settings.branding.invalidate(); };
  const setLogo = trpc.settings.setLogo.useMutation({ onSuccess: () => done("Logo toko disimpan."), onError: (error) => toast.error(error.message || "Logo gagal disimpan.") });
  const removeLogo = trpc.settings.removeLogo.useMutation({ onSuccess: () => done("Logo dihapus. Ikon bawaan dipakai kembali."), onError: (error) => toast.error(error.message || "Logo gagal dihapus.") });
  const busy = preparing || setLogo.isPending || removeLogo.isPending;

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try { setLogo.mutate(await prepareLogo(file)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Logo gagal diproses."); }
    finally { setPreparing(false); }
  };

  return <Panel title="Logo toko" description="Tampil di menu, halaman login, tab browser, dan laporan yang dicetak. PNG/JPG/WebP; gambar persegi dengan latar transparan paling rapi. Ukuran otomatis diperkecil.">
    <div className="logo-settings">
      <StoreMark branding={branding.data} size={88} />
      <div className="logo-settings-text">
        <strong>{branding.data?.businessName ?? "—"}</strong>
        <span>{branding.data?.logoUrl ? "Logo aktif." : "Belum ada logo — ikon bawaan dipakai."} Nama toko diubah di “Store Information” di atas.</span>
        <div className="logo-settings-actions">
          <button type="button" className="button primary" disabled={busy} onClick={() => input.current?.click()}><ImageUp size={16} /> {busy && !removeLogo.isPending ? "Menyimpan…" : branding.data?.logoUrl ? "Ganti logo" : "Unggah logo"}</button>
          {branding.data?.logoUrl && <button type="button" className="button ghost danger-text" disabled={busy} onClick={() => removeLogo.mutate()}><Trash2 size={16} /> Hapus logo</button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
  </Panel>;
}
