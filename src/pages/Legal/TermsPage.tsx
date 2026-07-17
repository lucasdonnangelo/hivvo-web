import { useNavigate } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-text-primary">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-muted leading-relaxed">{children}</p>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside flex flex-col gap-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-text-muted leading-relaxed">{item}</li>
      ))}
    </ul>
  )
}

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-8"
        >
          ← Voltar
        </button>

        <h1 className="text-2xl font-medium text-text-primary mb-1">Termos de Uso — Hivvo</h1>
        <p className="text-xs text-text-muted mb-10">Última atualização: julho de 2026</p>

        <div className="flex flex-col gap-7">
          <Section title="1. Aceitação dos Termos">
            <P>
              Ao criar uma conta ou utilizar o Hivvo, você concorda com estes Termos de Uso. Se não
              concordar, não utilize o serviço.
            </P>
          </Section>

          <Section title="2. O Serviço">
            <P>
              O Hivvo é uma aplicação web de gestão financeira pessoal com inteligência artificial,
              desenvolvida e operada por Lucas Jannuzzi Reis Donnangelo, com sede em São Paulo/SP. O
              serviço é oferecido atualmente de forma gratuita.
            </P>
          </Section>

          <Section title="3. Cadastro e Conta">
            <Ul items={[
              'O Hivvo é destinado a maiores de 18 anos.',
              'É responsabilidade do usuário manter suas credenciais em segurança.',
              'Cada usuário pode ter apenas uma conta ativa.',
              'Informações falsas ou incorretas podem resultar no encerramento da conta.',
            ]} />
          </Section>

          <Section title="4. Uso Aceitável">
            <P>
              Você concorda em não utilizar o serviço para fins ilegais, tentar acessar dados de
              outros usuários, realizar engenharia reversa ou compartilhar sua conta com terceiros.
            </P>
          </Section>

          <Section title="5. Dados Financeiros">
            <P>
              O Hivvo não se conecta automaticamente a instituições financeiras. Os dados são
              inseridos por você — manualmente ou por importação de arquivo (CSV, ou fatura/extrato
              em PDF, com reconhecimento automático por inteligência artificial; veja a Política de
              Privacidade §4). O Hivvo não oferece serviços de intermediação financeira,
              investimento ou crédito.
            </P>
          </Section>

          <Section title="6. Inteligência Artificial">
            <P>
              Os insights gerados pela IA têm caráter exclusivamente informativo e educacional. Não
              constituem consultoria financeira ou assessoria profissional. O usuário é o único
              responsável pelas suas decisões financeiras. Sobre o tratamento dos dados enviados à
              IA, veja a Política de Privacidade §4.
            </P>
          </Section>

          <Section title="7. Disponibilidade do Serviço">
            <P>
              O Hivvo é oferecido no estado em que se encontra, sem garantia de disponibilidade
              ininterrupta.
            </P>
          </Section>

          <Section title="8. Limitação de Responsabilidade">
            <P>
              O Hivvo não se responsabiliza por perdas financeiras, decisões baseadas nos dados do
              app, indisponibilidade temporária ou perda de dados por falhas técnicas além do nosso
              controle.
            </P>
          </Section>

          <Section title="9. Alterações nos Termos">
            <P>
              Alterações significativas serão comunicadas por e-mail e/ou no aplicativo antes de
              entrarem em vigor. O uso continuado implica aceitação dos novos termos.
            </P>
          </Section>

          <Section title="10. Encerramento de Conta">
            <P>
              Você pode encerrar sua conta a qualquer momento nas Configurações. Seus dados serão
              excluídos imediatamente, conforme a Política de Privacidade §9.
            </P>
          </Section>

          <Section title="11. Lei Aplicável">
            <P>
              Estes Termos são regidos pelas leis brasileiras. Foro: Comarca de São Paulo/SP.
            </P>
          </Section>

          <Section title="12. Contato">
            <P>contato@hivvo.app</P>
          </Section>
        </div>
      </div>
    </div>
  )
}
