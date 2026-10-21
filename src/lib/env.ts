import { z } from 'zod';

/**
 * Variáveis públicas do Supabase. Podem ir ao navegador: o acesso aos dados é
 * limitado pela RLS. A chave de serviço não é usada (decisão D2).
 *
 * O acesso a `process.env.NEXT_PUBLIC_*` é feito de forma direta para que o
 * Next.js consiga embutir os valores no código do navegador.
 */
const publicEnvSchema = z.object({
  supabaseUrl: z.url({ protocol: /^https?$/ }),
  supabasePublishableKey: z.string().trim().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      'Configuração do Supabase ausente ou inválida: defina NEXT_PUBLIC_SUPABASE_URL e ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).',
    );
  }
  return parsed.data;
}
