import { LEGAL } from './legal.config';

export type LegalDoc = 'privacy' | 'terms';

export interface LegalSection {
  title: string;
  /** Párrafos; los que empiezan con "• " se muestran como lista. */
  body: string[];
}

export interface LegalText {
  title: string;
  intro: string;
  sections: LegalSection[];
}

function contact(lang: 'es' | 'en'): string {
  const inApp = lang === 'es' ? 'desde la app, en Cuenta → Enviar comentarios' : 'from the app, in Account → Send feedback';
  if (!LEGAL.email) return inApp;
  return lang === 'es' ? `escribiendo a ${LEGAL.email} o ${inApp}` : `by writing to ${LEGAL.email} or ${inApp}`;
}

function owner(lang: 'es' | 'en'): string {
  if (LEGAL.owner) return lang === 'es' ? `Wallit es un proyecto de ${LEGAL.owner}, con base en Argentina.` : `Wallit is a project by ${LEGAL.owner}, based in Argentina.`;
  return lang === 'es' ? 'Wallit es un proyecto independiente con base en Argentina.' : 'Wallit is an independent project based in Argentina.';
}

const ES: Record<LegalDoc, LegalText> = {
  privacy: {
    title: 'Política de privacidad',
    intro: `${owner('es')} Acá te contamos qué datos guardamos, para qué y qué podés hacer con ellos.`,
    sections: [
      {
        title: 'Qué datos guardamos',
        body: [
          '• Tu cuenta: email, nombre y, si la cargás, tu foto de perfil. Si entrás con Google, recibimos tu nombre, email y foto de esa cuenta.',
          '• Lo que cargás: ingresos, gastos, ahorros, inversiones, categorías, presupuestos, gastos fijos y cuotas.',
          '• Fotos de tickets o facturas que decidas adjuntar a un movimiento.',
          '• Tus grupos: los movimientos, pagos y datos de cobro (alias, CBU/CVU o IBAN) que compartís con sus miembros.',
          '• Preferencias de avisos y los datos técnicos para mandarte notificaciones a tu dispositivo.',
        ],
      },
      {
        title: 'Para qué los usamos',
        body: [
          'Solo para que Wallit funcione: mostrarte tus números, compartirlos con los grupos que elijas, mandarte los avisos que activaste y armar tus resúmenes. No vendemos tus datos ni los usamos para publicidad.',
        ],
      },
      {
        title: 'Inteligencia artificial',
        body: [
          'Cuando cargás un movimiento escribiéndolo, dictándolo o con una foto, ese texto, audio o imagen se envía a un proveedor de IA (Groq) para interpretarlo. Para el resumen del mes se envían solo totales por categoría, sin descripciones. Wallit no guarda los audios. La IA puede equivocarse: revisá siempre lo que propone antes de guardar.',
        ],
      },
      {
        title: 'Con quién se comparten',
        body: [
          '• Con los miembros de tus grupos: lo que cargás en un grupo (salvo lo marcado como privado), tu nombre, tu foto y tus datos de cobro.',
          '• Con los proveedores que hacen andar la app: Supabase (base de datos, inicio de sesión y archivos), Vercel (la web), Groq (IA), Google (si entrás con Google) y los servicios de notificaciones de Apple, Google y Mozilla. Sus servidores pueden estar fuera de Argentina.',
          'No compartimos tus datos con nadie más, salvo que una ley o una autoridad competente lo exija.',
        ],
      },
      {
        title: 'Cuánto tiempo',
        body: [
          'Mientras tengas tu cuenta. Si la eliminás, borramos tus datos personales en el momento. Los movimientos que cargaste en grupos compartidos se mantienen, sin tu nombre ni tu email, para que las cuentas de los demás sigan cuadrando.',
        ],
      },
      {
        title: 'Tus derechos',
        body: [
          `Podés ver y corregir tus datos desde la app, descargar tus movimientos y eliminar tu cuenta desde Cuenta → Eliminar mi cuenta. Para cualquier otro pedido de acceso, rectificación o supresión, contactanos ${contact('es')}.`,
          'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
        ],
      },
      {
        title: 'Seguridad',
        body: [
          'La conexión va cifrada y cada persona solo puede ver sus datos y los de sus grupos (lo controla la base de datos, no solo la app). Ningún sistema es infalible: si detectamos un problema que te afecte, te avisamos.',
        ],
      },
      {
        title: 'Cambios',
        body: ['Si cambiamos esta política te lo vamos a avisar en la app. La fecha de la última actualización está abajo.'],
      },
    ],
  },
  terms: {
    title: 'Términos y condiciones',
    intro: `${owner('es')} Al usar Wallit aceptás estos términos.`,
    sections: [
      {
        title: 'Qué es Wallit',
        body: [
          'Una herramienta para registrar y ordenar tus finanzas personales y del hogar, sola o con otras personas. Wallit no mueve dinero, no es un banco ni una billetera virtual y no da asesoramiento financiero, impositivo ni legal.',
        ],
      },
      {
        title: 'Tu cuenta',
        body: [
          'Sos responsable de lo que cargás y de cuidar el acceso a tu cuenta. Tenés que tener al menos 13 años, o la edad que exija la ley de tu país para usar este tipo de servicios.',
        ],
      },
      {
        title: 'Grupos',
        body: [
          'Lo que cargás en un grupo lo ven sus miembros. Los saldos y deudas son un cálculo a partir de lo que cargan las personas: verificalos antes de transferir. Wallit no es parte de los acuerdos entre los miembros.',
        ],
      },
      {
        title: 'Inteligencia artificial',
        body: [
          'Las funciones con IA (cargar con texto, voz o foto y el resumen del mes) son una ayuda y pueden cometer errores. Revisá los datos antes de guardarlos. Hay un límite diario de uso para que el servicio siga siendo gratuito.',
        ],
      },
      {
        title: 'Uso aceptable',
        body: [
          'No uses Wallit para actividades ilegales, para cargar datos de terceros sin su permiso ni para intentar acceder a cuentas o datos ajenos. Podemos suspender cuentas que lo hagan.',
        ],
      },
      {
        title: 'Disponibilidad',
        body: [
          'Wallit se ofrece "tal cual está". Hacemos lo posible para que funcione bien y tus datos estén a salvo, pero puede haber cortes o errores. En la medida que lo permita la ley, no somos responsables por decisiones tomadas en base a la información de la app ni por pérdidas indirectas.',
        ],
      },
      {
        title: 'Baja',
        body: [
          'Podés dejar de usar Wallit y eliminar tu cuenta cuando quieras desde Cuenta → Eliminar mi cuenta. Mirá la Política de privacidad para saber qué pasa con tus datos.',
        ],
      },
      {
        title: 'Cambios y ley aplicable',
        body: [
          `Si cambiamos estos términos te lo vamos a avisar en la app. Se rigen por las leyes de la República Argentina. Para cualquier consulta, contactanos ${contact('es')}.`,
        ],
      },
    ],
  },
};

const EN: Record<LegalDoc, LegalText> = {
  privacy: {
    title: 'Privacy policy',
    intro: `${owner('en')} Here is what data we keep, why, and what you can do with it.`,
    sections: [
      {
        title: 'What we keep',
        body: [
          '• Your account: email, name and, if you add one, your profile photo. If you sign in with Google, we receive your name, email and photo from that account.',
          '• What you add: income, expenses, savings, investments, categories, budgets, fixed expenses and installments.',
          '• Receipt photos you choose to attach to a transaction.',
          '• Your groups: the transactions, payments and payment details (alias, account number or IBAN) you share with their members.',
          '• Notification preferences and the technical data needed to send notifications to your device.',
        ],
      },
      {
        title: 'Why we use it',
        body: ['Only to make Wallit work: show you your numbers, share them with the groups you choose, send the notifications you turned on and build your summaries. We don’t sell your data or use it for ads.'],
      },
      {
        title: 'Artificial intelligence',
        body: ['When you add a transaction by typing, speaking or with a photo, that text, audio or image is sent to an AI provider (Groq) to understand it. For the monthly summary we only send totals by category, without descriptions. Wallit does not keep audio recordings. AI can make mistakes: always check what it suggests before saving.'],
      },
      {
        title: 'Who we share it with',
        body: [
          '• Members of your groups: what you add to a group (except items marked private), your name, photo and payment details.',
          '• The providers that run the app: Supabase (database, sign-in and files), Vercel (website), Groq (AI), Google (if you sign in with Google) and the notification services of Apple, Google and Mozilla. Their servers may be outside Argentina.',
          'We don’t share your data with anyone else unless the law or a competent authority requires it.',
        ],
      },
      {
        title: 'How long',
        body: ['While you have an account. If you delete it, we erase your personal data right away. Transactions you added to shared groups are kept, without your name or email, so the other members’ balances still add up.'],
      },
      {
        title: 'Your rights',
        body: [
          `You can see and correct your data in the app, export your transactions and delete your account in Account → Delete my account. For any other access, correction or deletion request, contact us ${contact('en')}.`,
          'Argentina’s Agency for Access to Public Information (AAIP), as the supervisory authority under Law 25,326, handles complaints from anyone whose personal data rights have been affected.',
        ],
      },
      {
        title: 'Security',
        body: ['Connections are encrypted and each person can only see their own data and their groups’ (enforced by the database, not just the app). No system is perfect: if we detect a problem that affects you, we’ll let you know.'],
      },
      {
        title: 'Changes',
        body: ['If we change this policy we’ll let you know in the app. The last update date is below.'],
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: `${owner('en')} By using Wallit you accept these terms.`,
    sections: [
      {
        title: 'What Wallit is',
        body: ['A tool to record and organize your personal and household finances, on your own or with others. Wallit doesn’t move money, isn’t a bank or wallet and doesn’t give financial, tax or legal advice.'],
      },
      {
        title: 'Your account',
        body: ['You’re responsible for what you add and for keeping access to your account safe. You must be at least 13, or the age required by your country’s law for this kind of service.'],
      },
      {
        title: 'Groups',
        body: ['What you add to a group is visible to its members. Balances and debts are calculated from what people add: check them before transferring money. Wallit is not a party to agreements between members.'],
      },
      {
        title: 'Artificial intelligence',
        body: ['AI features (adding by text, voice or photo, and the monthly summary) are a help and can make mistakes. Check the data before saving. There is a daily usage limit to keep the service free.'],
      },
      {
        title: 'Acceptable use',
        body: ['Don’t use Wallit for illegal activities, to add other people’s data without their permission or to try to access other accounts or data. We may suspend accounts that do.'],
      },
      {
        title: 'Availability',
        body: ['Wallit is provided "as is". We do our best to keep it working and your data safe, but there may be outages or errors. To the extent permitted by law, we are not liable for decisions made based on the app’s information or for indirect losses.'],
      },
      {
        title: 'Leaving',
        body: ['You can stop using Wallit and delete your account at any time in Account → Delete my account. See the Privacy policy for what happens to your data.'],
      },
      {
        title: 'Changes and governing law',
        body: [`If we change these terms we’ll let you know in the app. They are governed by the laws of Argentina. For any questions, contact us ${contact('en')}.`],
      },
    ],
  },
};

export function legalText(doc: LegalDoc, lang: 'es' | 'en'): LegalText {
  return (lang === 'en' ? EN : ES)[doc];
}
