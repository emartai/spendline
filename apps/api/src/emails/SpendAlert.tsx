import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type SpendAlertProps = {
  email: string
  currentSpendUsd: number
  thresholdUsd: number
  topModel: string
  dashboardUrl: string
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
    maxWidth: '560px',
    padding: '32px',
  },
  accent: {
    color: '#2ECC8A',
  },
  amount: {
    color: '#2ECC8A',
    fontSize: '40px',
    fontWeight: '700',
    lineHeight: '1.1',
    margin: '24px 0 8px',
    textAlign: 'center' as const,
  },
  textCenter: {
    textAlign: 'center' as const,
  },
  badge: {
    backgroundColor: '#2ECC8A1A',
    border: '1px solid #2ECC8A33',
    borderRadius: '9999px',
    color: '#2ECC8A',
    display: 'inline-block',
    fontSize: '12px',
    padding: '6px 12px',
  },
  button: {
    backgroundColor: '#2ECC8A',
    borderRadius: '8px',
    color: '#0d1117',
    display: 'inline-block',
    fontWeight: '700',
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

export default function SpendAlert({
  email,
  currentSpendUsd,
  thresholdUsd,
  topModel,
  dashboardUrl,
}: SpendAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Spendline alert: ${currentSpendUsd.toFixed(2)} this month for {email}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.accent}>Spendline Alert</Text>
          <Heading style={styles.textCenter}>Monthly spend threshold reached</Heading>
          <Text style={styles.amount}>${currentSpendUsd.toFixed(2)}</Text>
          <Text style={styles.textCenter}>Threshold set at ${thresholdUsd.toFixed(2)}</Text>
          <Section style={styles.textCenter}>
            <Text style={styles.badge}>Top model: {topModel}</Text>
          </Section>
          <Section style={{ ...styles.textCenter, marginTop: '24px' }}>
            <Button href={dashboardUrl} style={styles.button}>
              Go to Dashboard
            </Button>
          </Section>
          <Hr style={{ borderColor: '#30363d', margin: '24px 0' }} />
          <Text style={styles.footer}>
            This alert is sent once per month after your configured threshold is crossed.
            Update your preferences in Spendline if you no longer want this notification.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

