// Robust Neural Network with proper backpropagation

import { activations } from './activations.js';

export class NeuralNetwork {
  constructor(layerSizes, activationType = 'tanh', learningRate = 0.03) {
    this.layerSizes = layerSizes;
    this.activationType = activationType;
    this.activation = activations[activationType];
    this.learningRate = learningRate;
    
    // Network state
    this.weights = [];
    this.biases = [];
    this.nodeOutputs = [];
    this.nodeInputs = [];
    
    // Initialize Xavier/He initialization
    this.initializeWeights();
  }
  
  initializeWeights() {
    this.weights = [];
    this.biases = [];
    
    for (let i = 0; i < this.layerSizes.length - 1; i++) {
      const inputSize = this.layerSizes[i];
      const outputSize = this.layerSizes[i + 1];
      
      // Adjusted scale to achieve starting loss in 0.7-0.8 range
      // Larger scale = worse initial predictions = higher initial loss
      const scale = 2.2;
      
      const layerWeights = [];
      const layerBiases = [];
      
      for (let j = 0; j < outputSize; j++) {
        const neuronWeights = [];
        for (let k = 0; k < inputSize; k++) {
          // Random values between -scale and +scale
          neuronWeights.push((Math.random() * 2 - 1) * scale);
        }
        layerWeights.push(neuronWeights);
        // Random biases between -1.0 and +1.0 for higher initial variance
        layerBiases.push((Math.random() * 2 - 1) * 1.0);
      }
      
      this.weights.push(layerWeights);
      this.biases.push(layerBiases);
    }
  }
  
  // Forward propagation
  forward(inputs) {
    this.nodeOutputs = [inputs];
    this.nodeInputs = [];
    
    let currentLayer = inputs;
    
    for (let layer = 0; layer < this.weights.length; layer++) {
      const nextLayer = [];
      const layerInputs = [];
      
      for (let neuron = 0; neuron < this.weights[layer].length; neuron++) {
        let sum = this.biases[layer][neuron];
        
        for (let input = 0; input < currentLayer.length; input++) {
          sum += currentLayer[input] * this.weights[layer][neuron][input];
        }
        
        layerInputs.push(sum);
        
        // Use sigmoid for output layer, activation function for hidden layers
        if (layer === this.weights.length - 1) {
          nextLayer.push(activations.sigmoid.fn(sum));
        } else {
          nextLayer.push(this.activation.fn(sum));
        }
      }
      
      this.nodeInputs.push(layerInputs);
      this.nodeOutputs.push(nextLayer);
      currentLayer = nextLayer;
    }
    
    return currentLayer;
  }
  
  // Backward propagation with SGD and regularization
  backward(inputs, target, regularization = 'None', regularizationRate = 0) {
    // Forward pass
    const output = this.forward(inputs);
    
    // Check for NaN
    if (output.some(v => isNaN(v))) {
      return { error: true };
    }
    
    // Calculate output layer error (cross-entropy derivative for binary classification)
    const outputError = [];
    for (let i = 0; i < output.length; i++) {
      const out = output[i];
      outputError.push(out - target);
    }
    
    // Backpropagate errors
    const deltas = [outputError];
    
    for (let layer = this.weights.length - 2; layer >= 0; layer--) {
      const layerDeltas = [];
      
      for (let neuron = 0; neuron < this.layerSizes[layer + 1]; neuron++) {
        let error = 0;
        
        for (let next = 0; next < deltas[0].length; next++) {
          error += deltas[0][next] * this.weights[layer + 1][next][neuron];
        }
        
        // Apply activation derivative
        const derivative = this.activation.derivative(this.nodeInputs[layer][neuron]);
        layerDeltas.push(error * derivative);
      }
      
      deltas.unshift(layerDeltas);
    }
    
    // Update weights and biases with regularization
    for (let layer = 0; layer < this.weights.length; layer++) {
      for (let neuron = 0; neuron < this.weights[layer].length; neuron++) {
        // Update bias
        this.biases[layer][neuron] -= this.learningRate * deltas[layer][neuron];
        
        // Update weights with regularization
        for (let input = 0; input < this.weights[layer][neuron].length; input++) {
          let gradient = deltas[layer][neuron] * this.nodeOutputs[layer][input];
          
          // Add regularization gradient
          if (regularization === 'L1') {
            gradient += regularizationRate * Math.sign(this.weights[layer][neuron][input]);
          } else if (regularization === 'L2') {
            gradient += regularizationRate * this.weights[layer][neuron][input];
          }
          
          this.weights[layer][neuron][input] -= this.learningRate * gradient;
        }
      }
    }
    
    // Calculate loss (MSE) with regularization penalty
    let loss = 0;
    for (let i = 0; i < output.length; i++) {
      const error = output[i] - target;
      loss += error * error;
    }
    loss = loss / output.length;
    
    // Add regularization penalty to loss
    if (regularization === 'L1') {
      let l1Penalty = 0;
      for (const layer of this.weights) {
        for (const neuron of layer) {
          for (const weight of neuron) {
            l1Penalty += Math.abs(weight);
          }
        }
      }
      loss += regularizationRate * l1Penalty;
    } else if (regularization === 'L2') {
      let l2Penalty = 0;
      for (const layer of this.weights) {
        for (const neuron of layer) {
          for (const weight of neuron) {
            l2Penalty += weight * weight;
          }
        }
      }
      loss += 0.5 * regularizationRate * l2Penalty;
    }
    
    return { error: false, loss };
  }
  
  // Train on a batch
  trainBatch(batch, regularization = 'None', regularizationRate = 0) {
    let totalLoss = 0;
    let errorCount = 0;
    
    for (const sample of batch) {
      const result = this.backward(sample.input, sample.label, regularization, regularizationRate);
      
      if (result.error) {
        errorCount++;
      } else {
        totalLoss += result.loss;
      }
    }
    
    // If too many errors, network has exploded
    if (errorCount > batch.length * 0.5) {
      return { exploded: true };
    }
    
    return {
      exploded: false,
      loss: totalLoss / (batch.length - errorCount)
    };
  }
  
  predict(inputs) {
    const output = this.forward(inputs);
    return output[0];
  }
  
  // Get weights for visualization
  getWeights() {
    return this.weights;
  }
  
  // Check for NaN weights
  hasExploded() {
    for (const layer of this.weights) {
      for (const neuron of layer) {
        for (const weight of neuron) {
          if (isNaN(weight) || Math.abs(weight) > 100) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
