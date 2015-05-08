define([
    'application',
    'util'
],
    
    function(App, util) {
        return Backbone.Marionette.Object.extend({
            initialize: function(options) {
                this.output = [];
                this.input = [];
                this.oscillators = [];
                var that = this;
                
                var lfoPwmEnabled = options.lfoPwmEnabled;
            
                // Sawtooth osc
                var sawtooth = createOsc.call(this, options.frequency, 'sawtooth', options.waveform.sawtoothLevel);
            
                // Pulse osc
                var pulseWidth;
                var pulseWidthNode;
                var pulse = createPulse.call(this, options.frequency, options.waveform.pulseWidth, options.waveform.pulseLevel);
            
                // Sub osc is a square wave -1 8ve from the main osc
                var sub = createOsc.call(this, options.frequency / 2, 'square', options.waveform.subLevel);
                
                var noise = createNoise.call(this, options.waveform.noiseLevel);
            
                // Start the oscillators, set up mod inputs
                _.each(this.oscillators, function(oscillator) {
                    oscillator.start(0);
                    oscillator.onended = destroyOscillator;
                    if(oscillator.frequency) {
                        this.input.push(oscillator.frequency);
                    }
                }, this);
            
                // Setter methods
                function setSubLevel(level) {
                    var now = App.context.currentTime;
                    sub.gain.cancelScheduledValues(now);
                    sub.gain.setValueAtTime(level, now);
                }
            
                function setRange(level) {

                }
            
                function setSawtoothLevel(level) {
                    var now = App.context.currentTime;
                    sawtooth.gain.cancelScheduledValues(now);
                    sawtooth.gain.setValueAtTime(level, now);
                }
                
                function setPulseLevel(level) {
                    var now = App.context.currentTime;
                    pulse.gain.cancelScheduledValues(now);
                    pulse.gain.setValueAtTime(level, now);
                }
                
                function setNoiseLevel(level) {
                    var now = App.context.currentTime;
                    noise.gain.cancelScheduledValues(now);
                    noise.gain.setValueAtTime(level, now);
                }
                
                function setPulseWidth(width) {
                    var now = App.context.currentTime;
                    
                    if(_.isUndefined(width)) {
                        width = pulseWidth;
                    }
                    pulseWidthNode.cancelScheduledValues(now);
                    pulseWidthNode.setValueAtTime(width, now);
                }
                
                function createNoise(level) {
                    var bufferSize = App.context.sampleRate;
                    var noiseBuffer = App.context.createBuffer(1, bufferSize, App.context.sampleRate);
                    var output = noiseBuffer.getChannelData(0);
                    var whiteNoise = App.context.createBufferSource();
                    var gain = App.context.createGain();
                    
                    for(var i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }

                    whiteNoise.buffer = noiseBuffer;
                    whiteNoise.loop = true;
                    gain.gain.value = util.getFaderCurve(level);
                    whiteNoise.connect(gain);
                    this.oscillators.push(whiteNoise);
                    this.output.push(gain);
                    return gain;
                }
                
                function createPulse(frequency, pwm, level) {
                    var osc = App.context.createPulseOscillator();
                    var gain = App.context.createGain();
                    
                    pwm *= 0.8;
                    
                    osc.frequency.value = frequency;
                    gain.gain.value = util.getFaderCurve(level);
                    osc.connect(gain);
                    
                    if(lfoPwmEnabled) {
                        osc.width.value = 0;
                    } else {
                        osc.width.value = pwm;
                    }
                    
                    this.oscillators.push(osc);
                    this.output.push(gain);
                    pulseWidthNode = osc.width;
                    pulseWidth = pwm;
                    return gain;
                }
            
                function createOsc(frequency, type, level) {
                    var osc = App.context.createOscillator();
                    var gain = App.context.createGain();
                    osc.type = type;
                    osc.frequency.value = frequency;                
                    gain.gain.value = util.getFaderCurve(level);
                    osc.connect(gain);
                    this.oscillators.push(osc);
                    this.output.push(gain);
                    return gain;
                }
            
                function destroyOscillator() {
                    that.trigger('destroyed');
                }
            
                this.noteOff = function() {
                    var now = App.context.currentTime;
                    _.each(this.oscillators, function(oscillator) {
                        oscillator.stop(now);
                    });
                };
            
                Object.defineProperties(this, {
                    'sawtooth': {
                        'set': function(value) { setSawtoothLevel(util.getFaderCurve(value)); }
                    },
                    'pulse': {
                        'set': function(value) { setPulseLevel(util.getFaderCurve(value)); }
                    },
                    'sub': {
                        'set': function(value) { setSubLevel(util.getFaderCurve(value)); }
                    },
                    'noise': {
                        'set': function(value) { setNoiseLevel(util.getFaderCurve(value)); }
                    },
                    'pwm': {
                        'get': function() { return pulseWidthNode; },
                        'set': function(value) { 
                            pulseWidth = value * 0.8;
                            if(!lfoPwmEnabled) {
                                setPulseWidth();
                            }
                            that.trigger('pwm', value);
                        }
                    },
                    'lfoPwmEnabled': {
                        'set': function(value) {
                            if(value) {
                                setPulseWidth(0);
                            } else {
                                setPulseWidth();
                            }
                            that.trigger('lfoPwmEnabled', value);
                        }
                    }
                });
               
            }
        });
    }
);