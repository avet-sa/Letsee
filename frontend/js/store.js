/**
 * Simple State Management Store for Letsee Frontend
 * Provides reactive state management with subscribers
 */

const Store = {
  /** @type {Object} - Application state */
  state: {
    currentUser: null,
    people: [],
    schedules: {},
    handovers: {},
    settings: {},
    isLoading: false,
    error: null,
  },

  /** @type {Array<Function>} - State change listeners */
  listeners: [],

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function when state changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  },

  /**
   * Update state and notify listeners
   * @param {Object} newState - New state to merge
   */
  setState(newState) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };

    // Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.state, oldState);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  },

  /**
   * Get a specific state value
   * @param {string} key - State key
   * @returns {any} - State value
   */
  getState(key) {
    return key ? this.state[key] : this.state;
  },

  /**
   * Reset state to initial values
   */
  reset() {
    this.setState({
      currentUser: null,
      people: [],
      schedules: {},
      handovers: {},
      settings: {},
      isLoading: false,
      error: null,
    });
  },

  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    this.setState({ isLoading: loading, error: null });
  },

  /**
   * Set error state
   * @param {string} error - Error message
   */
  setError(error) {
    this.setState({ error, isLoading: false });
  },

  /**
   * Clear error state
   */
  clearError() {
    this.setState({ error: null });
  },

  /**
   * Set current user
   * @param {Object} user - User object
   */
  setCurrentUser(user) {
    this.setState({ currentUser: user });
  },

  /**
   * Update people list
   * @param {Array} people - Array of people
   */
  setPeople(people) {
    this.setState({ people });
  },

  /**
   * Add or update a person
   * @param {Object} person - Person object
   */
  addOrUpdatePerson(person) {
    const people = [...this.state.people];
    const index = people.findIndex((p) => p.id === person.id);
    if (index >= 0) {
      people[index] = person;
    } else {
      people.push(person);
    }
    this.setState({ people });
  },

  /**
   * Remove a person
   * @param {string} personId - Person ID
   */
  removePerson(personId) {
    const people = this.state.people.filter((p) => p.id !== personId);
    this.setState({ people });
  },

  /**
   * Update handovers for a date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Array} handovers - Array of handovers
   */
  setHandoversForDate(date, handovers) {
    const handoversCopy = { ...this.state.handovers };
    handoversCopy[date] = handovers;
    this.setState({ handovers: handoversCopy });
  },

  /**
   * Get handovers for a date
   * @param {string} date - Date string
   * @returns {Array} - Array of handovers
   */
  getHandoversForDate(date) {
    return this.state.handovers[date] || [];
  },
};

// Initialize from localStorage if available
(function initStoreFromStorage() {
  try {
    const stored = localStorage.getItem('letsee_store');
    if (stored) {
      const parsed = JSON.parse(stored);
      Store.setState(parsed);
    }
  } catch (error) {
    console.warn('Failed to initialize store from localStorage:', error);
  }
})();

// Persist to localStorage on state changes
Store.subscribe((state) => {
  try {
    // Only persist specific parts of state
    const toPersist = {
      people: state.people,
      settings: state.settings,
    };
    localStorage.setItem('letsee_store', JSON.stringify(toPersist));
  } catch (error) {
    console.warn('Failed to persist store to localStorage:', error);
  }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
