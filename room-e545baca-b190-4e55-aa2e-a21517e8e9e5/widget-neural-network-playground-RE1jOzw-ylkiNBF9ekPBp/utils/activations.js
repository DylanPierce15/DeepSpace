// Activation functions and their derivatives

export const activations = {
  tanh: {
    fn: (x) => Math.tanh(x),
    derivative: (x) => 1 - Math.tanh(x) ** 2
  },
  relu: {
    fn: (x) => Math.max(0, x),
    derivative: (x) => x > 0 ? 1 : 0
  },
  sigmoid: {
    fn: (x) => 1 / (1 + Math.exp(-x)),
    derivative: (x) => {
      const sig = 1 / (1 + Math.exp(-x));
      return sig * (1 - sig);
    }
  },
  linear: {
    fn: (x) => x,
    derivative: (x) => 1
  }
};

export const activationOptions = ['tanh', 'relu', 'sigmoid', 'linear'];
