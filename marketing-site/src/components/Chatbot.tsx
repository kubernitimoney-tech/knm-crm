import { brand } from '@/lib/brand';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';

function whatsappDigits(): string {
  return brand.whatsappNumber.replace(/\D/g, '');
}

function whatsappUrl(): string {
  const digits = whatsappDigits();
  const text = encodeURIComponent(`Hi ${brand.name}, I need help with a loan.`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function Chatbot() {
  const digits = whatsappDigits();
  if (digits.length < 10) return null;

  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="whatsapp-float fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#20bd5a]"
    >
      <span className="whatsapp-wave inline-flex" aria-hidden="true">
        <WhatsAppIcon className="h-7 w-7" />
      </span>
    </a>
  );
}
