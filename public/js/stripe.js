/* eslint-disable */

import axios from 'axios';
import { showAlert } from './alerts';
// import { loadStripe } from '@stripe/stripe-js';

const stripe = Stripe(
  'pk_test_51MnhoDAfKYQAFRMU1R3eSI5bCFFVKdQGiAv0ntZUhzcwH5k3KODg7sCO3wuNOHdSgfifABADkPH8jdEe1lhrhvlL00pWgQAkn4'
);

export const bookTour = async (tourId) => {
  //   const stripe = await loadStripe(
  //     'pk_test_51MnhoDAfKYQAFRMU1R3eSI5bCFFVKdQGiAv0ntZUhzcwH5k3KODg7sCO3wuNOHdSgfifABADkPH8jdEe1lhrhvlL00pWgQAkn4'
  //   );
  try {
    // 1) Get checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
    );
    console.log(session);
    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
