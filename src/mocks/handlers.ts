/**
 * MSW Handlers for mocking API responses
 * Used in Storybook and tests
 */

import { http, HttpResponse } from 'msw';

export const handlers = [
  // Web3Forms API mock
  http.post('https://api.web3forms.com/submit', async ({ request }) => {
    const body = await request.formData();
    const honeypot = body.get('botcheck');

    // Simulate bot detection
    if (honeypot) {
      return HttpResponse.json(
        { success: false, message: 'Bot detected' },
        { status: 400 }
      );
    }

    // Simulate successful submission
    return HttpResponse.json(
      {
        success: true,
        message: 'Form submitted successfully',
        data: {
          name: body.get('name'),
          email: body.get('email'),
          message: body.get('message'),
        },
      },
      { status: 200 }
    );
  }),

  // Simulate offline submission failure
  http.post('https://api.web3forms.com/submit-offline', () => {
    return HttpResponse.error();
  }),
];
