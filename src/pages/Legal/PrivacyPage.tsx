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

function Subprocessor({ name, purpose, data }: { name: string; purpose: string; data: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-text-primary">{name}</span>
      <span className="text-sm text-text-muted leading-relaxed">Finalidade: {purpose}</span>
      <span className="text-sm text-text-muted leading-relaxed">Dados: {data}</span>
    </div>
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
        <p className="text-xs text-text-muted mb-10">Última atualização: julho de 2026</p>

        <div className="flex flex-col gap-7">
          <Section title="1. Introdução e Controlador">
            <P>
              Esta Política descreve como o Hivvo coleta, usa, compartilha e protege seus dados
              pessoais, em conformidade com a LGPD (Lei nº 13.709/2018). O controlador dos dados é
              Lucas Jannuzzi Reis Donnangelo (pessoa física), São Paulo/SP, que também atua como
              Encarregado (DPO). Contato: contato@hivvo.app.
            </P>
          </Section>

          <Section title="2. Dados que Coletamos">
            <Ul items={[
              <>
                <span className="text-text-primary font-medium">Cadastro:</span>{' '}
                nome completo, nome de usuário, e-mail e senha (armazenada com hash bcrypt, custo
                12 — nunca em texto puro).
              </>,
              <>
                <span className="text-text-primary font-medium">Financeiros:</span>{' '}
                transações (incluindo as descrições em texto livre que você digita), cartões,
                faturas, parcelas, recorrências e categorias personalizadas.
              </>,
              <>
                <span className="text-text-primary font-medium">Assistente de IA:</span>{' '}
                o histórico das suas conversas com o assistente (texto livre).
              </>,
              <>
                <span className="text-text-primary font-medium">Técnicos:</span>{' '}
                data e hora de acesso; e dados mínimos de diagnóstico de erros (rota, tipo de
                falha, stack trace sem valores pessoais) via Sentry, para corrigir problemas.
              </>,
              <>
                <span className="text-text-primary font-medium">Feedback enviado pelo app:</span>{' '}
                o texto que você escreve em Configurações e, junto dele, informações capturadas
                automaticamente para conseguirmos investigar o relato: seu nome, e-mail e
                identificador de conta, a versão do aplicativo, a tela em que você estava antes de
                abrir Configurações, o tamanho da tela e o navegador. A mensagem é enviada por
                e-mail para contato@hivvo.app e não é armazenada no banco de dados.
              </>,
            ]} />
          </Section>

          <Section title="3. Base Legal do Tratamento (LGPD, art. 7º e 11)">
            <Ul items={[
              <>
                <span className="text-text-primary font-medium">Execução do contrato:</span>{' '}
                cadastro e dados financeiros, para prestar o serviço.
              </>,
              <>
                <span className="text-text-primary font-medium">Consentimento:</span>{' '}
                envio de dados ao assistente de IA e à importação de fatura/extrato (você escolhe
                usar cada um).
              </>,
              <>
                <span className="text-text-primary font-medium">Legítimo interesse:</span>{' '}
                segurança da conta e correção de falhas técnicas.
              </>,
              <>
                <span className="text-text-primary font-medium">Obrigação legal / autoridades:</span>{' '}
                quando exigido por lei.
              </>,
            ]} />
          </Section>

          <Section title="4. Como Usamos seus Dados">
            <P>
              <span className="text-text-primary font-medium">Prestação do serviço:</span>{' '}
              exibir painel, projeções, relatórios e análises.
            </P>
            <P>
              <span className="text-text-primary font-medium">Assistente de IA e importação (Google Gemini):</span>{' '}
              utilizamos a API paga do Google Gemini. Conforme os Termos da API paga, o Google não
              usa o conteúdo enviado para treinar ou melhorar seus produtos e modelos, e o retém
              apenas por período limitado para segurança e conformidade.
            </P>
            <Ul items={[
              <>
                Ao usar o assistente ou a sugestão automática de categoria, enviamos ao Google o
                seu nome de usuário, valores financeiros agregados e o texto que você digita
                (perguntas no chat e descrições de transação). Não enviamos CPF, e-mail ou senha.
              </>,
              <>
                Ao <span className="text-text-primary font-medium">importar uma fatura ou
                extrato</span>, enviamos ao Google o texto extraído do arquivo para o
                reconhecimento automático das transações. Esse texto pode conter dados pessoais
                impressos no documento — como seu nome, endereço e os últimos dígitos do cartão.
                Removemos o CPF e os números de cartão antes do envio; os demais dados do documento
                são enviados como estão.
              </>,
            ]} />
            <P>
              <span className="text-text-primary font-medium">Atenção:</span>{' '}
              o texto livre que você escreve ou o documento que você importa pode conter dados
              pessoais (seus ou de terceiros). Evite incluir informações sensíveis que não sejam
              necessárias.
            </P>
            <P>
              <span className="text-text-primary font-medium">Comunicações:</span>{' '}
              e-mails transacionais (recuperação de senha, alertas de segurança) enviados via
              Resend — para isso, seu e-mail e nome completo são enviados a esse provedor.
            </P>
          </Section>

          <Section title="5. Compartilhamento e Subprocessadores">
            <P>
              Seus dados não são vendidos. Para operar, o Hivvo usa os seguintes provedores, todos
              com processamento fora do Brasil:
            </P>
            <div className="flex flex-col gap-3">
              <Subprocessor
                name="Google (API Gemini, tier pago)"
                purpose="Assistente de IA e reconhecimento de faturas/extratos importados"
                data="Nome de usuário, valores agregados, texto livre digitado e texto de documentos importados (ver §4)"
              />
              <Subprocessor
                name="Supabase"
                purpose="Banco de dados (armazena tudo)"
                data="Todos os dados da conta"
              />
              <Subprocessor
                name="Railway"
                purpose="Hospedagem do servidor (API)"
                data="Todos os dados em trânsito no serviço"
              />
              <Subprocessor
                name="Vercel"
                purpose="Hospedagem do aplicativo web"
                data="Dados de acesso ao app"
              />
              <Subprocessor
                name="Resend"
                purpose="Envio de e-mails transacionais e do feedback enviado pelo app"
                data="E-mail, nome completo e o conteúdo das mensagens de feedback"
              />
              <Subprocessor
                name="Cloudflare"
                purpose="Roteamento de e-mail, DNS e CDN"
                data="Metadados de rede; e-mails recebidos em contato@hivvo.app"
              />
              <Subprocessor
                name="Sentry"
                purpose="Monitoramento de erros"
                data="Metadados de falha, sem PII/corpo (ver §7)"
              />
            </div>
            <P>Também compartilhamos dados com autoridades quando exigido por lei.</P>
          </Section>

          <Section title="6. Transferência Internacional (LGPD, art. 33)">
            <P>
              Os provedores acima operam fora do Brasil — o banco de dados que armazena seus dados
              fica nos Estados Unidos, e os serviços de hospedagem e CDN podem operar em diferentes
              localidades internacionais. Assim, seus dados são transferidos e processados fora do
              Brasil. Essa transferência é necessária para a execução do serviço que você contrata.
              Ao usar o Hivvo, você está ciente dessa transferência.
            </P>
          </Section>

          <Section title="7. Segurança dos Dados">
            <Ul items={[
              'Senhas com hash bcrypt (custo 12).',
              'Autenticação por JWT em cookie httpOnly.',
              'Comunicação por HTTPS.',
              'Isolamento por usuário nas consultas e RLS ativado no banco.',
              'No monitoramento de erros (Sentry), configuração que descarta corpo de requisição, cookies, cabeçalhos sensíveis e variáveis de execução — recebemos apenas metadados de falha, nunca seus dados financeiros.',
            ]} />
          </Section>

          <Section title="8. Seus Direitos (LGPD, art. 18)">
            <P>
              Você tem direito a acesso, correção, exclusão, portabilidade, informação sobre
              compartilhamento e revogação do consentimento. Como exercer:
            </P>
            <Ul items={[
              <>
                <span className="text-text-primary font-medium">Excluir conta</span>{' '}
                (Configurações → Meus dados): remoção imediata e permanente dos seus dados no app.
              </>,
              <>
                <span className="text-text-primary font-medium">Começar do zero</span>{' '}
                (Configurações → Meus dados): apaga todos os seus dados financeiros, mantendo a
                conta.
              </>,
              <>Ou pelo canal contato@hivvo.app.</>,
            ]} />
          </Section>

          <Section title="9. Retenção de Dados">
            <P>
              Mantemos seus dados enquanto a conta estiver ativa. Ao excluir a conta, seus dados no
              app são removidos imediatamente; cópias de segurança podem persistir por um período
              limitado, conforme a política do provedor de banco de dados. Metadados de erro no
              Sentry são retidos por até 90 dias.
            </P>
          </Section>

          <Section title="10. Cookies">
            <P>
              Usamos apenas cookies essenciais de autenticação (tokens de acesso e de sessão,
              httpOnly). Não usamos cookies de publicidade nem de rastreamento de terceiros.
            </P>
          </Section>

          <Section title="11. Menores de Idade">
            <P>
              O Hivvo é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de
              menores de 18 anos.
            </P>
          </Section>

          <Section title="12. Alterações nesta Política">
            <P>
              Avisaremos por e-mail e/ou no aplicativo antes que mudanças relevantes entrem em
              vigor.
            </P>
          </Section>

          <Section title="13. Contato e Encarregado (DPO)">
            <P>
              Lucas Jannuzzi Reis Donnangelo — São Paulo/SP
              <br />
              contato@hivvo.app
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}
