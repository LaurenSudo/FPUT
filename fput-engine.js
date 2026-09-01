/* ==================================================================
   FPUT PHYSICS ENGINE

   A direct port of the Fortran simulation core in:
     https://github.com/NotQuiteAwake/fort-fput

   Source mapping:
     src/strings.f90     -> Chain state (y, v, a) + setNormalMode()
     src/forces.f90      -> the force law inside Chain.step()
     src/integrator.f90  -> TABLES (symp_c / symp_d) + Chain.step()
     src/modes.f90       -> Chain.basis() / Chain.modeEnergy()

   This file has no DOM or canvas dependencies. It can be dropped into
   Node, a worker, or any other JS environment on its own and used to
   run the simulation and pull out (y, v, mode energies) at each step.
   ================================================================== */

(function (global) {

  const TWOCR = Math.cbrt(2);
  const TMTCR = 2 - TWOCR;
  const OMTCR = 1 - TWOCR;

  // Per integrator order: list of [c_i, d_i] pairs, applied in sequence.
  // Directly transcribed from symp_c / symp_d in integrator.f90.
  const TABLES = {
    1: [ [1.0, 1.0] ],
    2: [ [1.0, 0.5], [0.0, 0.5] ],
    3: [ [2/3, 7/24], [-2/3, 3/4], [1.0, -1/24] ],
    4: [
      [1/(2*TMTCR), 0.0],
      [OMTCR/(2*TMTCR), 1/TMTCR],
      [OMTCR/(2*TMTCR), -TWOCR/TMTCR],
      [1/(2*TMTCR), 1/TMTCR]
    ]
  };

  class Chain {
    /**
     * @param {number} N     number of masses (including the two fixed ends)
     * @param {number} dx    equilibrium spacing between masses
     * @param {number} rho   linear mass density (mass per unit length)
     * @param {number} k     spring constant
     * @param {number} alpha FPUT nonlinearity coefficient (quadratic term)
     */
    constructor(N, dx, rho, k, alpha) {
      this.N = N; this.dx = dx; this.rho = rho; this.k = k; this.alpha = alpha;
      this.m = rho * dx;
      this.L = dx * (N - 1);
      this.y = new Float64Array(N);
      this.v = new Float64Array(N);
      this.a = new Float64Array(N);
      this.t = 0;
      // Cache of orthonormal sine mode shapes (fixed boundary conditions),
      // same shape as gen_nth_normal() in strings.f90 with default
      // (normalized) amplitude. Populated lazily by basis().
      this.modeBasis = [];
    }

    /** Reset the chain into a single pure normal mode. */
    setNormalMode(mode, amp) {
      const kk = mode * Math.PI / this.L;
      for (let i = 1; i < this.N - 1; i++) {
        this.y[i] = amp * Math.sin(kk * i * this.dx);
      }
      this.y[0] = 0; this.y[this.N - 1] = 0;
      this.v.fill(0);
      this.a.fill(0);
      this.t = 0;
    }

    /** Continuum-approximation period of the fundamental (mode 1). */
    fundamentalPeriod() {
      const wvec = Math.PI / this.L;
      const omega = wvec * Math.sqrt(this.k / this.rho);
      return 2 * Math.PI / omega;
    }

    /** Continuum-approximation angular frequency of a given mode. */
    modeFrequency(mode) {
      const wvec = mode * Math.PI / this.L;
      return wvec * Math.sqrt(this.k / this.rho);
    }

    /** Orthonormal sine-mode shape (discrete sine basis), cached. */
    basis(mode) {
      if (!this.modeBasis[mode]) {
        const A = Math.sqrt(2 / (this.N - 1));
        const kk = mode * Math.PI / this.L;
        const phi = new Float64Array(this.N);
        for (let i = 1; i < this.N - 1; i++) {
          phi[i] = A * Math.sin(kk * i * this.dx);
        }
        this.modeBasis[mode] = phi;
      }
      return this.modeBasis[mode];
    }

    /** Energy currently held in a given linear normal mode. */
    modeEnergy(mode) {
      const phi = this.basis(mode);
      let q = 0, qdot = 0;
      for (let i = 1; i < this.N - 1; i++) {
        q += this.y[i] * phi[i];
        qdot += this.v[i] * phi[i];
      }
      const omega = this.modeFrequency(mode);
      return 0.5 * (qdot * qdot + omega * omega * q * q);
    }

    /**
     * Advance the chain by one timestep using the symplectic composition
     * of the requested order (1-4). Directly mirrors the do-loop over
     * symp_c(i, order) / symp_d(i, order) in integrator.f90, including
     * the alpha-FPUT force law from forces.f90:
     *   F = k * (y' + alpha * y'^2)   where y' = dy/dx
     */
    step(order, dt) {
      const table = TABLES[order] || TABLES[4];
      const N = this.N, y = this.y, v = this.v, a = this.a;
      const dx = this.dx, k = this.k, alpha = this.alpha, m = this.m;
      const f = this._f || (this._f = new Float64Array(N - 1));

      for (let s = 0; s < table.length; s++) {
        const cc = table[s][0], dd = table[s][1];

        for (let j = 0; j < N; j++) y[j] += dt * cc * v[j];

        for (let j = 0; j < N - 1; j++) {
          const dy = y[j + 1] - y[j];
          const yp = dy / dx;
          f[j] = k * (yp + alpha * yp * yp);
        }

        a[0] = 0; a[N - 1] = 0;
        for (let mI = 1; mI < N - 1; mI++) {
          a[mI] = (f[mI] - f[mI - 1]) / m;
        }

        for (let j = 0; j < N; j++) v[j] += dt * dd * a[j];
      }
      this.t += dt;
    }
  }

  const FPUT = { Chain, TABLES };

  // UMD-ish export: works as a plain <script> global, and as a CommonJS
  // module if someone pulls this file into Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FPUT;
  } else {
    global.FPUT = FPUT;
  }

})(typeof window !== 'undefined' ? window : globalThis);
