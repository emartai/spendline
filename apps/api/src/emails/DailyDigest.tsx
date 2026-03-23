import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

type DailyDigestProps = {
  email: string
  totalSpendUsd: number
  requestCount: number
  modelBreakdown: Array<{ model: string; spend_usd: number; requests: number }>
  dashboardUrl: string
  date: string
}

const styles = {
  body: {
    backgroundColor: '#0d1117',
    color: '#e6edf3',
    fontFamily: 'Arial, sans-serif',
    margin: '0',
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '16px',
    margin: '0 auto',
    maxWidth: '640px',
    padding: '32px',
  },
  accent: {
    color: '#2ECC8A',
  },
  statCard: {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '12px',
    padding: '16px',
  },
  statLabel: {
    color: '#8b949e',
    fontSize: '12px',
    margin: '0 0 8px',
    textTransform: 'uppercase' as const,
  },
  statValue: {
    color: '#2ECC8A',
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.2',
    margin: '0',
  },
  table: {
    marginTop: '24px',
    width: '100%',
  },
  th: {
    borderBottom: '1px solid #30363d',
    color: '#8b949e',
    fontSize: '12px',
    padding: '12px 8px',
    textAlign: 'left' as const,
    textTransform: 'uppercase' as const,
  },
  td: {
    borderBottom: '1px solid #21262d',
    padding: '12px 8px',
  },
  button: {
    backgroundColor: '#2ECC8A',
    borderRadius: '8px',
    color: '#0d1117',
    display: 'inline-block',
    fontWeight: '700',
    marginTop: '24px',
    padding: '12px 20px',
    textDecoration: 'none',
  },
  footer: {
    color: '#8b949e',
    fontSize: '12px',
    lineHeight: '1.5',
    marginTop: '24px',
  },
} satisfies Record<string, Record<string, string | number>>

export default function DailyDigest({
  email,
  totalSpendUsd,
  requestCount,
  modelBreakdown,
  dashboardUrl,
  date,
}: DailyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Spendline daily digest for {date} sent to {email}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.accent}>Spendline Daily Digest</Text>
          <Heading>Yesterday&apos;s spend summary</Heading>
          <Text>{date}</Text>

          <Section>
            <Row>
              <Column style={{ paddingRight: '8px' }}>
                <Section style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Spend</Text>
                  <Text style={styles.statValue}>${totalSpendUsd.toFixed(2)}</Text>
                </Section>
              </Column>
              <Column style={{ paddingLeft: '8px' }}>
                <Section style={styles.statCard}>
                  <Text style={styles.statLabel}>Requests</Text>
                  <Text style={styles.statValue}>{requestCount}</Text>
                </Section>
              </Column>
            </Row>
          </Section>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Spend</th>
                <th style={styles.th}>Requests</th>
              </tr>
            </thead>
            <tbody>
              {modelBreakdown.map((item) => (
                <tr key={item.model}>
                  <td style={styles.td}>{item.model}</td>
                  <td style={styles.td}>${item.spend_usd.toFixed(2)}</td>
                  <td style={styles.td}>{item.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Section>
            <Button href={dashboardUrl} style={styles.button}>
              Go to Dashboard
            </Button>
          </Section>

          <Text style={styles.footer}>
            You are receiving this because daily digest emails are enabled in your
            Spendline alert settings.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

