export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  city: string;
  rating: number;
}

export const testimonials: Testimonial[] = [
  {
    id: '1',
    quote:
      'Kuberniti Money helped me during a medical emergency. The process was smooth and the team was supportive throughout.',
    name: 'Priya N.',
    city: 'Bengaluru',
    rating: 5,
  },
  {
    id: '2',
    quote:
      'Got clarity on repayment before I applied. Transparent and professional — exactly what I needed.',
    name: 'Rahul M.',
    city: 'Mumbai',
    rating: 5,
  },
  {
    id: '3',
    quote:
      'Applied from my phone during lunch break. Quick verification and funds when I needed them most.',
    name: 'Ananya S.',
    city: 'Delhi',
    rating: 5,
  },
  {
    id: '4',
    quote:
      'The team explained every step clearly. No hidden surprises — I knew what to expect from day one.',
    name: 'Vikram K.',
    city: 'Hyderabad',
    rating: 4,
  },
  {
    id: '5',
    quote:
      'Needed funds for wedding expenses. Kuberniti Money made it stress-free with a simple application.',
    name: 'Meera P.',
    city: 'Pune',
    rating: 5,
  },
  {
    id: '6',
    quote:
      'As a salaried professional, I appreciated how they verified my income quickly and disbursed on time.',
    name: 'Arjun D.',
    city: 'Chennai',
    rating: 5,
  },
  {
    id: '7',
    quote:
      'Customer support answered all my questions about documents and eligibility before I applied.',
    name: 'Kavita R.',
    city: 'Ahmedabad',
    rating: 4,
  },
  {
    id: '8',
    quote:
      'Responsible lending with clear terms. They helped me manage a short-term bill crunch without worry.',
    name: 'Suresh G.',
    city: 'Kolkata',
    rating: 5,
  },
];
