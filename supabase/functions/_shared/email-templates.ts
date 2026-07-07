export function getEmailSubject(type: string): string {
  const subjects: Record<string, string> = {
    payment_success: 'Payment Successful',
    payment_failure: 'Payment Failed',
    subscription_created: 'Subscription Activated',
  };
  return subjects[type] || 'Payment Notification';
}

export function getEmailHtml(type: string, data: Record<string, any>): string {
  return `<html><body><h2>Payment Notification</h2><p>Type: ${type}</p></body></html>`;
}

export function getEmailText(type: string, data: Record<string, any>): string {
  return `Payment Notification - Type: ${type}`;
}
