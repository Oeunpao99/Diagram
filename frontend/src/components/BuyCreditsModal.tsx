import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api/client";
import type { Billing, CreditPack, Payment } from "../api/types";
import { useAuth } from "../store/useAuth";
import { useBilling } from "../store/useBilling";
import { CheckCircle, Download, Sparkles, X } from "./icons";

/** How often an open QR asks *our* server about the payment. The server
 *  decides how often it really asks Bakong (whose API is rate-limited), so
 *  this can stay quick without costing anything. */
const POLL_MS = 5000;

/** KHQR's own brand red, for the header band of the payment card — the same
 *  band every Cambodian banking app shows, so the QR is recognisable as one
 *  any of them can pay. */
const KHQR_RED = "#E1232E";

function money(cents: number, currency: string) {
  const value = cents / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return currency === "USD" ? `$${text}` : `${text} ${currency}`;
}

function perCredit(pack: CreditPack) {
  return `${Number((pack.amount_cents / pack.credits).toFixed(2))}¢ per credit`;
}

function remaining(expiresAt: string, now: number) {
  const ms = Math.max(0, new Date(expiresAt).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function message(err: unknown) {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function BuyCreditsModal() {
  const reason = useBilling((s) => s.reason);
  const close = useBilling((s) => s.closeBilling);
  const user = useAuth((s) => s.user);
  const setCredits = useAuth((s) => s.setCredits);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const closeButton = useRef<HTMLButtonElement>(null);

  const open = reason !== null && user !== null;

  // Fresh pack list and balance each time the dialog opens; forget any
  // previous checkout so it never reopens on a stale QR.
  useEffect(() => {
    if (!open) return;
    setPayment(null);
    setQrImage(null);
    setError(null);
    api
      .billing()
      .then((b) => {
        setBilling(b);
        setCredits(b.credits);
      })
      .catch((err) => setError(message(err)));
    closeButton.current?.focus();
  }, [open, setCredits]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Render the KHQR string as an image.
  useEffect(() => {
    if (!payment) return;
    let cancelled = false;
    QRCode.toDataURL(payment.qr, { errorCorrectionLevel: "M", margin: 1, width: 480 })
      .then((url) => !cancelled && setQrImage(url))
      .catch(() => !cancelled && setError("Couldn't draw the QR code."));
    return () => {
      cancelled = true;
    };
  }, [payment?.qr]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a QR is on screen: poll for the payment, and tick the countdown.
  const pending = open && payment?.status === "pending";
  const paymentId = payment?.id;
  useEffect(() => {
    if (!pending || !paymentId) return;
    const poll = window.setInterval(async () => {
      try {
        const next = await api.payment(paymentId);
        setPayment(next);
        setCredits(next.balance);
      } catch {
        /* a missed poll is fine — the next one asks again */
      }
    }, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [pending, paymentId, setCredits]);

  const checkNow = useCallback(async () => {
    if (!paymentId) return;
    setChecking(true);
    try {
      const next = await api.payment(paymentId, true);
      setPayment(next);
      setCredits(next.balance);
    } catch (err) {
      setError(message(err));
    } finally {
      setChecking(false);
    }
  }, [paymentId, setCredits]);

  const buy = useCallback(async (pack: CreditPack) => {
    setBusyPack(pack.id);
    setError(null);
    try {
      setPayment(await api.checkout(pack.id));
      setNow(Date.now());
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyPack(null);
    }
  }, []);

  if (!open) return null;

  const heading =
    payment?.status === "paid"
      ? "Credits added"
      : payment
        ? "Scan to pay"
        : reason === "out"
          ? "You're out of credits"
          : "Buy credits";

  return (
    <div
      className="fixed inset-0 z-[320] grid place-items-center bg-[rgba(16,24,32,0.32)] p-6 backdrop-blur-[7px] animate-[modal-fade_180ms_ease]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="flex max-h-[92vh] w-[min(520px,100%)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(10,20,30,0.35)] animate-[modal-in_200ms_ease]"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <header className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[18px] font-semibold text-ink-strong">{heading}</h2>
            <p className="mb-0 mt-1 text-[13px] text-slate">
              Balance: <strong className="text-ink-strong">{user.credits}</strong> credits
            </p>
          </div>
          <button
            ref={closeButton}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-slate hover:text-ink-strong [&_svg]:size-4"
            onClick={close}
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          {error && (
            <p
              className="mb-4 mt-0 rounded-lg border border-brand-red px-3 py-2 text-[13px] text-brand-red"
              role="alert"
            >
              {error}
            </p>
          )}

          {!payment && <PackPicker billing={billing} busyPack={busyPack} onBuy={buy} reason={reason} />}

          {payment?.status === "pending" && (
            <div className="flex flex-col items-center">
              <div className="w-[min(280px,100%)] overflow-hidden rounded-2xl border border-line bg-white shadow-2">
                <div
                  className="px-5 py-3 text-center text-[17px] font-bold tracking-[0.12em] text-white"
                  style={{ background: KHQR_RED }}
                >
                  KHQR
                </div>
                <div className="px-5 pb-1 pt-3 text-[#111]">
                  <p className="m-0 text-[13px] font-medium">{payment.merchant_name}</p>
                  <p className="m-0 mt-0.5 text-[26px] font-bold leading-tight">
                    {money(payment.amount_cents, payment.currency)}
                  </p>
                </div>
                <div className="mx-5 border-t border-dashed border-[#c9c9c9]" />
                <div className="grid place-items-center p-4">
                  {qrImage ? (
                    <img src={qrImage} alt="KHQR payment code" className="size-[220px]" />
                  ) : (
                    <div className="size-[220px]" role="status" aria-label="Drawing QR code" />
                  )}
                </div>
              </div>

              <p className="mb-0 mt-4 text-center text-[13.5px] text-ink">
                Scan with <strong>ABA, ACLEDA, Wing</strong> or any Bakong app.
              </p>
              <p
                className="mb-0 mt-1.5 flex items-center gap-2 text-[13px] text-slate"
                role="status"
                aria-live="polite"
              >
                <span className="inline-block size-2 animate-pulse rounded-full bg-green" />
                Waiting for payment · expires in {remaining(payment.expires_at, now)}
              </p>
              {payment.check_delayed && (
                <p className="mb-0 mt-2 max-w-[340px] text-center text-[12.5px] leading-[1.6] text-slate">
                  Payment confirmation is delayed right now. If you've already paid, your
                  credits are safe — they'll be added automatically, or when you next open
                  this window.
                </p>
              )}

              <button
                className="mt-4 cursor-pointer rounded-lg border border-green bg-green px-5 py-2 text-[13.5px] font-semibold text-on-accent hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void checkNow()}
                disabled={checking}
              >
                {checking ? "Checking…" : "I've paid — check now"}
              </button>

              <div className="mt-3 flex gap-2">
                {qrImage && (
                  // On a phone you can't scan your own screen: save the QR,
                  // then open it from the banking app's "scan from gallery".
                  <a
                    href={qrImage}
                    download={`kumnous-khqr-${payment.pack}.png`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3.5 py-2 text-[13px] font-medium text-ink-strong no-underline hover:border-green [&_svg]:size-4"
                  >
                    <Download />
                    Save QR
                  </a>
                )}
                <button
                  className="cursor-pointer rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-strong hover:border-green"
                  onClick={() => setPayment(null)}
                >
                  Choose another pack
                </button>
              </div>
            </div>
          )}

          {payment?.status === "paid" && (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-green text-on-accent [&_svg]:size-7">
                <CheckCircle />
              </span>
              <p className="mb-0 mt-4 text-[16px] font-semibold text-ink-strong">
                +{payment.credits} credits
              </p>
              <p className="mb-0 mt-1 text-[13.5px] text-slate">
                Payment received. You now have {payment.balance} credits.
              </p>
              <button
                className="mt-6 cursor-pointer rounded-lg border border-green bg-green px-6 py-2.5 text-[14px] font-semibold text-on-accent hover:bg-green-strong"
                onClick={close}
              >
                Keep creating
              </button>
            </div>
          )}

          {payment?.status === "expired" && (
            <div className="flex flex-col items-center py-4 text-center">
              <p className="m-0 text-[15px] font-semibold text-ink-strong">This QR code expired</p>
              <p className="mb-0 mt-1 text-[13.5px] text-slate">
                Nothing was charged. Make a new one to pay.
              </p>
              <button
                className="mt-5 cursor-pointer rounded-lg border border-green bg-green px-5 py-2.5 text-[14px] font-semibold text-on-accent hover:bg-green-strong"
                onClick={() => setPayment(null)}
              >
                New QR code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PackPicker({
  billing,
  busyPack,
  onBuy,
  reason,
}: {
  billing: Billing | null;
  busyPack: string | null;
  onBuy: (pack: CreditPack) => void;
  reason: string | null;
}) {
  if (!billing) return <div className="h-[220px]" role="status" aria-label="Loading packs" />;

  const best = billing.packs.reduce<CreditPack | null>(
    (a, b) => (!a || b.amount_cents / b.credits < a.amount_cents / a.credits ? b : a),
    null,
  );

  return (
    <>
      <p className="mb-4 mt-0 text-[13.5px] leading-[1.6] text-ink">
        {reason === "out"
          ? "Top up to keep generating and revising diagrams. "
          : "Credits never expire. "}
        Pay once by KHQR — no card, no subscription.
      </p>

      {!billing.payments_enabled && (
        <p className="mb-4 mt-0 rounded-lg border border-line-strong px-3 py-2 text-[13px] text-slate">
          Payments aren't switched on for this server yet.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 max-[460px]:grid-cols-1">
        {billing.packs.map((pack) => {
          const highlight = pack.id === best?.id && billing.packs.length > 1;
          return (
            <div
              key={pack.id}
              className={`flex flex-col rounded-xl p-4 ${highlight ? "border-2 border-solid border-green" : "border border-line"}`}
            >
              <p className="m-0 h-[18px] text-[12px] font-semibold uppercase tracking-[0.08em] text-green">
                {highlight ? "Best value" : ""}
              </p>
              <p className="m-0 mt-1 text-[14px] font-semibold text-ink-strong">{pack.name}</p>
              <p className="m-0 mt-1 text-[30px] font-semibold leading-none text-ink-strong">
                {money(pack.amount_cents, pack.currency)}
              </p>
              <p className="m-0 mt-2 text-[14px] text-ink">
                <strong>{pack.credits}</strong> credits
              </p>
              <p className="m-0 mt-0.5 text-[12px] text-slate">{perCredit(pack)}</p>
              <button
                className={`mt-4 cursor-pointer rounded-lg px-4 py-2 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                  highlight
                    ? "border border-green bg-green text-on-accent hover:bg-green-strong"
                    : "border border-line-strong bg-surface text-ink-strong hover:border-green"
                }`}
                disabled={!billing.payments_enabled || busyPack !== null}
                onClick={() => onBuy(pack)}
              >
                {busyPack === pack.id ? "Making QR…" : `Pay ${money(pack.amount_cents, pack.currency)}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-line px-4 py-3 text-[12.5px] leading-[1.7] text-slate">
        <p className="m-0 flex items-center gap-1.5 font-semibold text-ink-strong [&_svg]:size-3.5">
          <Sparkles /> What a credit buys
        </p>
        <p className="m-0 mt-1">
          <strong className="text-ink">1 credit</strong> — generate a diagram, or one change from the
          copilot
        </p>
        <p className="m-0">
          <strong className="text-ink">2 credits</strong> — read a sketch or photo, or write documentation
        </p>
        <p className="m-0">
          <strong className="text-ink">Free</strong> — editing, layout, checks and export
        </p>
      </div>
    </>
  );
}
