/*
 * Animate Plus v2.1.1
 * Copyright (c) 2017-2018 Benjamin De Cock
 * http://animateplus.com/license
 */
 
// logic
// =====
const first = ([item]) => item;

const computeValue = (value, index) => typeof value == "function" ? value(index) : value; 

// dom
// ===
const getElements = elements => {
  if (Array.isArray(elements)) return elements;
  if (!elements || elements.nodeType) return [elements];
  return Array.from(typeof elements == "string" ? document.querySelectorAll(elements) : elements);
};

const accelerate = ({
  style
}, keyframes) => style.willChange = keyframes ? keyframes.map(({
  property
}) => property).join() : "auto";

const createSVG = (element, attributes) => Object.entries(attributes).reduce((node, [attribute, value]) => {
  node.setAttribute(attribute, value);
  return node;
}, document.createElementNS("http://www.w3.org/2000/svg", element)); 

// motion blur
// ===========
const blurs = {
  axes: ["x", "y"],
  count: 0,

  add({
    element,
    blur
  }) {
    const id = `motion-blur-${this.count++}`;
    const svg = createSVG("svg", {
      style: "position: absolute; width: 0; height: 0"
    });
    const filter = createSVG("filter", this.axes.reduce((attributes, axis) => {
      const offset = blur[axis] * 2;
      attributes[axis] = `-${offset}%`;
      attributes[axis == "x" ? "width" : "height"] = `${100 + offset * 2}%`;
      return attributes;
    }, {
      id,
      "color-interpolation-filters": "sRGB"
    }));
    const gaussian = createSVG("feGaussianBlur", {
      in: "SourceGraphic"
    });
    filter.append(gaussian);
    svg.append(filter);
    element.style.filter = `url("#${id}")`;
    document.body.prepend(svg);
    return gaussian;
  }

};

const getDeviation = (blur, {
  easing
}, curve) => {
  const progress = blur * curve;
  const out = blur - progress;

  const deviation = (() => {
    if (easing == "linear") return blur;
    if (easing.startsWith("in-out")) return (curve < .5 ? progress : out) * 2;
    if (easing.startsWith("in")) return progress;
    return out;
  })();

  return Math.max(0, deviation);
};

const setDeviation = ({
  blur,
  gaussian,
  easing
}, curve) => {
  const values = blurs.axes.map(axis => getDeviation(blur[axis], easing, curve));
  gaussian.setAttribute("stdDeviation", values.join());
};

const normalizeBlur = blur => {
  const defaults = blurs.axes.reduce((object, axis) => {
    object[axis] = 0;
    return object;
  }, {});
  return Object.assign(defaults, blur);
};

const clearBlur = ({
  style
}, {
  parentNode: {
    parentNode: svg
  }
}) => {
  style.filter = "none";
  svg.remove();
}; 

// color conversion
// ================
const hexPairs = color => {
  const split = color.split("");
  const pairs = color.length < 5 ? split.map(string => string + string) : split.reduce((array, string, index) => {
    if (index % 2) array.push(split[index - 1] + string);
    return array;
  }, []);
  if (pairs.length < 4) pairs.push("ff");
  return pairs;
};

const convert = color => hexPairs(color).map(string => parseInt(string, 16));

const rgba = hex => {
  const color = hex.slice(1);
  const [r, g, b, a] = convert(color);
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}; 

// easing equations
// ================
const pi2 = Math.PI * 2;

const getOffset = (strength, period) => period / pi2 * Math.asin(1 / strength);

const easings = {
  "linear": progress => progress,
  "in-cubic": progress => Math.pow(progress, 3),
  "in-quartic": progress => Math.pow(progress, 4),
  "in-quintic": progress => Math.pow(progress, 5),
  "in-exponential": progress => Math.pow(1024, progress - 1),
  "in-circular": progress => 1 - Math.sqrt(1 - Math.pow(progress, 2)),
  "in-elastic": (progress, amplitude, period) => {
    const strength = Math.max(amplitude, 1);
    const offset = getOffset(strength, period);
    return -(strength * Math.pow(2, 10 * (progress -= 1)) * Math.sin((progress - offset) * pi2 / period));
  },
  "out-cubic": progress => Math.pow(--progress, 3) + 1,
  "out-quartic": progress => 1 - Math.pow(--progress, 4),
  "out-quintic": progress => Math.pow(--progress, 5) + 1,
  "out-exponential": progress => 1 - Math.pow(2, -10 * progress),
  "out-circular": progress => Math.sqrt(1 - Math.pow(--progress, 2)),
  "out-elastic": (progress, amplitude, period) => {
    const strength = Math.max(amplitude, 1);
    const offset = getOffset(strength, period);
    return strength * Math.pow(2, -10 * progress) * Math.sin((progress - offset) * pi2 / period) + 1;
  },
  "in-out-cubic": progress => (progress *= 2) < 1 ? .5 * Math.pow(progress, 3) : .5 * ((progress -= 2) * Math.pow(progress, 2) + 2),
  "in-out-quartic": progress => (progress *= 2) < 1 ? .5 * Math.pow(progress, 4) : -.5 * ((progress -= 2) * Math.pow(progress, 3) - 2),
  "in-out-quintic": progress => (progress *= 2) < 1 ? .5 * Math.pow(progress, 5) : .5 * ((progress -= 2) * Math.pow(progress, 4) + 2),
  "in-out-exponential": progress => (progress *= 2) < 1 ? .5 * Math.pow(1024, progress - 1) : .5 * (-Math.pow(2, -10 * (progress - 1)) + 2),
  "in-out-circular": progress => (progress *= 2) < 1 ? -.5 * (Math.sqrt(1 - Math.pow(progress, 2)) - 1) : .5 * (Math.sqrt(1 - (progress -= 2) * progress) + 1),
  "in-out-elastic": (progress, amplitude, period) => {
    const strength = Math.max(amplitude, 1);
    const offset = getOffset(strength, period);
    return (progress *= 2) < 1 ? -.5 * (strength * Math.pow(2, 10 * (progress -= 1)) * Math.sin((progress - offset) * pi2 / period)) : strength * Math.pow(2, -10 * (progress -= 1)) * Math.sin((progress - offset) * pi2 / period) * .5 + 1;
  }
};

const decomposeEasing = string => {
  const [easing, amplitude = 1, period = .4] = string.trim().split(" ");
  return {
    easing,
    amplitude,
    period
  };
};

const ease = ({
  easing,
  amplitude,
  period
}, progress) => easings[easing](progress, amplitude, period); // keyframes composition
// =====================


const extractRegExp = /-?\d*\.?\d+/g;

const extractStrings = value => value.split(extractRegExp);

const extractNumbers = value => value.match(extractRegExp).map(Number);

const sanitize = values => values.map(value => {
  const string = String(value);
  return string.startsWith("#") ? rgba(string) : string;
});

const addPropertyKeyframes = (property, values) => {
  const animatable = sanitize(values);
  const strings = extractStrings(first(animatable));
  const numbers = animatable.map(extractNumbers);
  const round = first(strings).startsWith("rgb");
  return {
    property,
    strings,
    numbers,
    round
  };
};

const createAnimationKeyframes = (keyframes, index) => Object.entries(keyframes).map(([property, values]) => addPropertyKeyframes(property, computeValue(values, index)));

const getCurrentValue = (from, to, easing) => from + (to - from) * easing;

const recomposeValue = ([from, to], strings, round, easing) => strings.reduce((style, string, index) => {
  const previous = index - 1;
  const value = getCurrentValue(from[previous], to[previous], easing);
  return style + (round && index < 4 ? Math.round(value) : value) + string;
});

const createStyles = (keyframes, easing) => keyframes.reduce((styles, {
  property,
  numbers,
  strings,
  round
}) => {
  styles[property] = recomposeValue(numbers, strings, round, easing);
  return styles;
}, {});

const reverseKeyframes = keyframes => keyframes.forEach(({
  numbers
}) => numbers.reverse()); 

// animation tracking
// ==================
const rAF = {
  all: new Set(),

  add(object) {
    if (this.all.add(object).size < 2) requestAnimationFrame(tick);
  }

};
const paused = {};
const tracks = new Set(); 

// extra controls
const trackTime = (timing, now) => {
  if (!timing.startTime) timing.startTime = now;
  timing.elapsed = now - timing.startTime;
};

const resetTime = object => object.startTime = 0;

const getProgress = ({
  elapsed,
  duration
}) => duration > 0 ? Math.min(elapsed / duration, 1) : 1;

const setSpeed = (speed, value, index) => speed > 0 ? computeValue(value, index) / speed : 0;

const addAnimations = (options, resolve) => {
  const {
    elements = null,
    name = undefined,
    easing = "out-elastic",
    duration = 1000,
    delay: timeout = 0,
    speed = 1,
    loop = false,
    optimize = false,
    direction = "normal",
    blur = null,
    change = null,
    ...rest
  } = options;
  const last = {
    totalDuration: -1
  };
  getElements(elements).forEach(async (element, index) => {
    const keyframes = createAnimationKeyframes(rest, index);
    const animation = {
      element,
      name,
	  speed,
      keyframes,
      loop,
      optimize,
      direction,
      change,
      easing: decomposeEasing(easing),
      duration: setSpeed(speed, duration, index)
    };
    const animationTimeout = setSpeed(speed, timeout, index);
    const totalDuration = animationTimeout + animation.duration;
    if (direction != "normal") reverseKeyframes(keyframes);

    if (element) {
      if (optimize) accelerate(element, keyframes);

      if (blur) {
        animation.blur = normalizeBlur(computeValue(blur, index));
        animation.gaussian = blurs.add(animation);
      }
    }

    if (totalDuration > last.totalDuration) {
      last.animation = animation;
      last.totalDuration = totalDuration;
    }

    if (animationTimeout) await delay(animationTimeout);
    rAF.add(animation);
  });
  const {
    animation
  } = last;
  if (!animation) return;
  animation.end = resolve;
  animation.options = options;
};

const tick = now => {
  const {
    all
  } = rAF;
  all.forEach(object => {
    trackTime(object, now);
    const progress = getProgress(object);
    const {
      element,
      name,
	  speed,
      keyframes,
      loop,
      optimize,
      direction,
      change,
      easing,
      duration,
      gaussian,
      end,
      options
    } = object; 
	
	// object is an animation
    if (direction) {
      let curve = progress;

      switch (progress) {
        case 0:
          if (direction == "alternate") reverseKeyframes(keyframes);
          break;

        case 1:
          if (loop) resetTime(object);else {
            all.delete(object);
            if (optimize && element) accelerate(element);
            if (gaussian) clearBlur(element, gaussian);
          }
          if (end) end(options);
          break;

        default:
          curve = ease(easing, progress);
      }

      if (gaussian) setDeviation(object, curve);
      if (change && end) change(curve);
      if (element) Object.assign(element.style, createStyles(keyframes, curve));
      return;
    } 
	
	// object is a delay
    if (progress < 1) return;
    all.delete(object);
    end(duration);
  });
  if (all.size) requestAnimationFrame(tick);
};

document.addEventListener("visibilitychange", () => {
  const now = performance.now();

  if (document.hidden) {
    const {
      all
    } = rAF;
    paused.time = now;
    paused.all = new Set(all);
    all.clear();
    return;
  }

  const {
    all,
    time
  } = paused;
  if (!all) return;
  const elapsed = now - time;
  paused.time = null;
  paused.all = new Set();
  requestAnimationFrame(() => all.forEach(object => {
    object.startTime += elapsed;
    rAF.add(object);
  }));
}); 

// additional controls functions
// ==================

const updateProgress = (object, now, progress, stated, time) => {
  if (progress != null) {
    const progressed = object.duration * progress;
    if(stated == "running")	return now - progressed;
	if(stated == "paused"){
		if(time) return time - progressed;
		if(now) return now - progressed;	
		return object.startTime;	
	};
  } else {
    return object.startTime + (now - time);
  }
};

const updateObject = (object, now, progress, stated, time) => {
  object.startTime = updateProgress(object, now, progress, stated);
  Object.assign(object.element.style, createStyles(object.keyframes, ease(object.easing, progress)));
  if (object.change) object.change(progress);
};

const checkProgress = progress => progress < 0 ? 0 : progress > 1 ? 1 : progress;

const checkOutput = (output, arr, nodes, elements, animations, func) => {
  const isTracks = arr == tracks;
  animations.trim().split(",").map(animations => [...arr].filter(isTracks ? ref => (nodes && nodes.includes(ref.object.element) || !nodes && !elements && ref.object.element) && (animations && ref.object.name == animations || !animations) : ref => (nodes && nodes.includes(ref.element) || !nodes && !elements && ref.element) && (animations && ref.name == animations || !animations)).reduce((acc, ref) => {
    func(ref);
    //return acc.add(isTracks ? ref.object : ref); 
	return acc.add(isTracks ? ref.object.element : ref.element);
  }, new Set()).forEach(output.add, output));
};

const resolveOutput = output => output.size > 0 ? Array.from(output) : null; 

// exports
// =======


export default (options => new Promise(resolve => addAnimations(options, resolve)));
export const delay = duration => new Promise(resolve => rAF.add({
  duration,
  end: resolve
})); 

// additional controls
// ==================  

export const direction = ({
  elements,
  animations = "",
  direction,
  progress
} = {}) => new Promise(resolve => {
  const directions = new Set(["normal", "reverse", "alternate"]);
  const now = performance.now();
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;

  const workings = (object, stated, time) => {
    const directed = directions.has(direction) ? direction : "normal";
    object.direction = directed;

    if (directed != "normal" && direction != "normal") {
      const progressive = progress ? progress : getProgress(object);
      const diff = 1 - progressive;
      reverseKeyframes(object.keyframes);
      object.startTime = updateProgress(object, now, diff, stated, time);
    }
  };

  checkOutput(output, tracks, nodes, elements, animations, item => {
    workings(item.object, "paused", item.time);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    workings(object, "running");
  });
  resolve(resolveOutput(output));
}, (elements, animations, direction, checkProgress(progress)));

export const easing = ({
  elements,
  animations = "",
  easing
} = {}) => new Promise(resolve => {
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  let dataset;

  const workings = (object, stated, easing) => {
    object.easing = decomposeEasing(easing);
    const progress = getProgress(object);
    Object.assign(object.element.style, createStyles(object.keyframes, ease(object.easing, progress)));
  };

  checkOutput(output, tracks, nodes, elements, animations, item => {
    workings(item.object, "paused", easing);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    workings(object, "running", easing);
  });
  resolve(resolveOutput(output));
}, (elements, animations, easing));

export const loop = ({
  elements,
  animations = "",
  loop
} = {}) => new Promise(resolve => {
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  checkOutput(output, tracks, nodes, elements, animations, item => {
    item.object.loop = loop;
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    object.loop = loop;
  });
  resolve(resolveOutput(output));
}, (elements, animations, typeof loop === "boolean" ? loop : false));

export const pause = ({
  elements,
  animations = "",
  progress
} = {}) => new Promise(resolve => {
  const now = performance.now();
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  let dataset;
  checkOutput(output, tracks, nodes, elements, animations, item => {
    if (progress) updateObject(item.object, now, progress, "paused", item.time);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    if (progress) updateObject(object, now, progress, "paused");
    tracks.add({
      "object": object,
      "time": now
    });
    rAF.all.delete(object);
  });
  if (!nodes && !elements && !animations) rAF.all.clear();
  resolve(resolveOutput(output));
}, (elements, animations, checkProgress(progress)));

export const play = ({
  elements,
  animations = "",
  progress
} = {}) => new Promise(resolve => {
  const now = performance.now();
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  let dataset;
  checkOutput(output, tracks, nodes, elements, animations, item => {
    item.object.startTime = updateProgress(item.object, now, progress, "paused", item.time);
    rAF.add(item.object);
    tracks.delete(item);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    if (progress) object.startTime = updateProgress(object, now, progress, "running");
  });
  resolve(resolveOutput(output));
}, (elements, animations, checkProgress(progress)));

export const seek = ({
  elements,
  animations = "",
  progress
} = {}) => new Promise(resolve => {
  const now = performance.now();
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  let dataset;
  checkOutput(output, tracks, nodes, elements, animations, item => {
    if (progress) {
      item.object.startTime += now - item.time;
      item.time = now;
      updateObject(item.object, now, progress, "paused", item.time);
    }
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    if (progress) updateObject(object, now, progress, "running");
  });
  resolve(resolveOutput(output));
}, (elements, animations, checkProgress(progress)));

export const speed = ({
  elements,
  animations = "",
  speed
} = {}) => new Promise(resolve => {
  const now = performance.now();
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  let dataset;

  const workings = (object, speed, stated, time) => {
    const diff = object.speed > 0 ? object.speed - 1 + 1 : 1 - object.speed + 1;
    const progress = getProgress(object);
    object.speed = speed;
    object.duration = setSpeed(object.speed, object.duration * diff);
    const progressed = object.duration * progress;
    object.elapsed = progressed;
    object.startTime = stated == "running" ? now - progressed : stated == "paused" ? time - progressed : object.startTime;
  };

  checkOutput(output, tracks, nodes, elements, animations, item => {
    workings(item.object, speed, "paused", item.time);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    workings(object, speed, "running");
  });
  resolve(resolveOutput(output));
}, (elements, animations, speed > 0 ? speed : 1));

export const stop = ({
  elements,
  animations = "",
  progress
} = {}) => new Promise(resolve => {
  const now = performance.now();
  const output = new Set();
  const nodes = elements ? getElements(elements) : null;
  let dataset;
  checkOutput(output, tracks, nodes, elements, animations, item => {
    if (progress) updateObject(item.object, now, progress, "stopped");
    tracks.delete(item);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    if (progress) updateObject(object, now, progress, "stopped");
    rAF.all.delete(object);
  });

  if (!nodes && !elements && !animations) {
    rAF.all.clear();
    tracks.clear();
  }

  resolve(resolveOutput(output));
}, (elements, animations, checkProgress(progress)));

export const toggle = ({
  elements,
  animations = "",
  progress
} = {}) => new Promise(resolve => {
  const now = performance.now();
  const output = new Set();
  const toggler = [];
  const nodes = elements ? getElements(elements) : null;
  let dataset;
  checkOutput(output, tracks, nodes, elements, animations, item => {
    item.object.startTime = updateProgress(item.object, now, progress, "paused", item.time);
    rAF.add(item.object);
    tracks.delete(item);
    toggler.push(item.object);
  });
  checkOutput(output, rAF.all, nodes, elements, animations, object => {
    if (progress) updateObject(object, now, progress, "paused");

    if (toggler && toggler.includes(object)) {
      tracks.delete(object);
      rAF.add(object);
    } else {
      tracks.add({
        "object": object,
        "time": now
      });
      rAF.all.delete(object);
    }
  });
  resolve(resolveOutput(output));
}, (elements, animations, checkProgress(progress)));