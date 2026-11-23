// Loaded only in the profiling builds, before either application's entry point.
(() => {
  const commits = [];
  const components = Object.create(null);
  const memo = { calls: 0, factories: 0, ms: 0, factoryMs: 0 };
  const callback = { calls: 0, hits: 0, ms: 0 };
  const comparator = { calls: 0, equal: 0, ms: 0 };
  const autoCache = { calls: 0, accessMs: 0, guards: 0, misses: 0, guardMs: 0 };
  let owner;

  window.desktopProfile = {
    commits,
    components,
    memo,
    callback,
    comparator,
    autoCache,
    step: "mount",
    onRender(_id, phase, actual, base, start, commit) {
      commits.push({
        step: window.desktopProfile.step,
        phase,
        actual,
        base,
        start,
        commit,
      });
    },
    invoke(fiber, fn, props, secondArg) {
      const name =
        fiber.elementType?.displayName ||
        fn.displayName ||
        fn.name ||
        "(anonymous)";
      components[name] ??= {
        calls: 0,
        mounts: 0,
        selfMs: 0,
        memoCalls: 0,
        memoFactories: 0,
        memoMs: 0,
        callbackCalls: 0,
        callbackMs: 0,
        cacheCalls: 0,
        cacheGuards: 0,
        cacheMisses: 0,
      };
      const row = components[name];
      row.calls++;
      if (!fiber.alternate) row.mounts++;

      const previous = owner;
      owner = row;
      const start = performance.now();
      try {
        return fn(props, secondArg);
      } finally {
        row.selfMs += performance.now() - start;
        owner = previous;
      }
    },
    useMemo(dispatcher, factory, deps) {
      const timedFactory = () => {
        const start = performance.now();
        const value = factory();
        memo.factoryMs += performance.now() - start;
        memo.factories++;
        if (owner) owner.memoFactories++;
        return value;
      };

      memo.calls++;
      const start = performance.now();
      const value = dispatcher.useMemo(timedFactory, deps);
      const elapsed = performance.now() - start;
      memo.ms += elapsed;
      if (owner) {
        owner.memoCalls++;
        owner.memoMs += elapsed;
      }
      return value;
    },
    useCallback(dispatcher, fn, deps) {
      callback.calls++;
      const start = performance.now();
      const value = dispatcher.useCallback(fn, deps);
      const elapsed = performance.now() - start;
      callback.ms += elapsed;
      if (owner) {
        owner.callbackCalls++;
        owner.callbackMs += elapsed;
      }
      return value;
    },
    useMemoCache(dispatcher, size) {
      const start = performance.now();
      const cache = dispatcher.useMemoCache(size);
      autoCache.accessMs += performance.now() - start;
      autoCache.calls++;
      if (owner) owner.cacheCalls++;
      return cache;
    },
    cacheGuard(start, invalid) {
      autoCache.guardMs += performance.now() - start;
      autoCache.guards++;
      if (invalid) autoCache.misses++;
      if (owner) {
        owner.cacheGuards++;
        if (invalid) owner.cacheMisses++;
      }
      return invalid;
    },
    compare(fn, previous, next) {
      comparator.calls++;
      const start = performance.now();
      const equal = fn(previous, next);
      comparator.ms += performance.now() - start;
      if (equal) comparator.equal++;
      return equal;
    },
  };
})();
