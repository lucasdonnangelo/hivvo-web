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

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc list-inside flex flex-col gap-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-text-muted leading-relaxed">{item}</li>
      ))}
    </ul>
  )
}

export default function PrivacyPage() {
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

        <h1 className="text-2xl font-medium text-text-primary mb-1">
          Política de Privacidade — Hivvo
        </h1>
        <p className="text-xs text-text-muted mb-10">Última atualização: junho de 2026</p>

        <div className="flex flex-col gap-7">
          <Section title="1. Introdução">
            <P>
              Esta Política descreve como o Hivvo coleta, usa e protege seus dados pessoais, em
              conformidade com a LGPD (Lei nº 13.709/2018).
            </P>
          </Section>

          <Section title="2. Dados que Coletamos">
            <Ul items={[
              <>
                <span className="text-text-primary font-medium">Dados de cadastro:</span>{' '}
                nome completo, nome de usuário, e-mail e senha (armazenada com bcrypt).
              </>,
              <>
                <span className="text-text-primary font-medium">Dados financeiros:</span>{' '}
                transações, cartões de crédito, categorias personalizadas e parcelas.
              </>,
              <>
                <span className="text-text-primary font-medium">Dados de uso:</span>{' '}
                data e hora de acesso e histórico de conversas com o assistente de IA.
              </>,
            ]} />
          </Section>

          <Section title="3. Como Usamos seus Dados">
            <Ul items={[
              <>
                <span className="text-text-primary font-medium">Prestação do serviço:</span>{' '}
                exibir painel financeiro, relatórios e análises.
              </>,
              <>
                <span className="text-text-primary font-medium">Assistente de IA:</span>{' '}
                dados financeiros do mês enviados ao Google Gemini — sem dados de identificação pessoal.
              </>,
              <>
                <span className="text-text-primary font-medium">Comunicações:</span>{' '}
                emails transacionais (recuperação de senha, alertas de segurança).
              </>,
            ]} />
          </Section>

          <Section title="4. Compartilhamento de Dados">
            <P>
              Seus dados não são vendidos. Compartilhamos apenas com: Google Gemini API (dados
              financeiros sem identificação), Supabase (banco de dados), Resend (emails
              transacionais) e autoridades quando exigido por lei.
            </P>
          </Section>

          <Section title="5. Segurança dos Dados">
            <Ul items={[
              'Senhas com hash bcrypt',
              'JWT em cookie httpOnly',
              'Comunicação via HTTPS',
              'Dados isolados por usuário',
            ]} />
          </Section>

          <Section title="6. Seus Direitos (LGPD)">
            <P>
              Acesso, correção, exclusão, portabilidade e revogação. Contato: contato@hivvo.app
            </P>
          </Section>

          <Section title="7. Retenção de Dados">
            <P>
              Dados mantidos enquanto a conta estiver ativa. Excluídos em até 30 dias após
              encerramento. Logs de segurança mantidos por até 90 dias.
            </P>
          </Section>

          <Section title="8. Cookies">
            <P>
              Apenas um cookie essencial de autenticação (httpOnly). Sem cookies de rastreamento ou
              publicidade.
            </P>
          </Section>

          <Section title="9. Menores de Idade">
            <P>
              Permitido a partir de 13 anos. Entre 13 e 15 anos requer consentimento dos
              responsáveis. Não coletamos dados de menores de 13 anos.
            </P>
          </Section>

          <Section title="10. Alterações nesta Política">
            <P>
              Comunicadas por email com antecedência mínima de 15 dias.
            </P>
          </Section>

          <Section title="11. Contato e DPO">
            <P>
              Lucas Jannuzzi Reis Donnangelo — São Paulo, SP
              <br />
              contato@hivvo.app
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}
