// ESLint Flat Config (ESLint 9+)
// https://eslint.org/docs/latest/use/configure/migration-guide

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser globals
        browser: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        history: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        FormData: "readonly",

        // App-specific globals
        DB: "readonly",
        API_BASE: "readonly",
        AuthAPI: "readonly",
        PeopleAPI: "readonly",
        SchedulesAPI: "readonly",
        HandoversAPI: "readonly",
        SettingsAPI: "readonly",
        FilesAPI: "readonly",
        Store: "readonly",

        // Utility functions
        showAlert: "readonly",
        showConfirm: "readonly",
        closeAlertModal: "readonly",
        closeConfirmModal: "readonly",
        executeConfirmAction: "readonly",
        escapeHtml: "readonly",
        sanitizeInput: "readonly",
        generateUUID: "readonly",
        formatDate: "readonly",
        formatTime: "readonly",

        // People functions
        updatePeopleBlock: "readonly",
        renderPeopleList: "readonly",
        openPeopleModal: "readonly",
        closePeopleModal: "readonly",
        startPersonEdit: "readonly",
        cancelPersonEdit: "readonly",
        savePerson: "readonly",
        deletePerson: "readonly",

        // Handover functions
        renderHandoverNotes: "readonly",
        saveNote: "readonly",
        editNote: "readonly",
        deleteNote: "readonly",
        toggleComplete: "readonly",
        downloadCurrentAttachment: "readonly",
        closeAttachmentModal: "readonly",

        // Search/filter functions
        applyQuickFilter: "readonly",
        bulkDelete: "readonly",
        bulkToggleComplete: "readonly",
        toggleSelect: "readonly",
        clearSelection: "readonly",

        // Date navigation
        changeDate: "readonly",
        changeMonth: "readonly",
        toggleDatePicker: "readonly",
        updateDatePickerCalendar: "readonly",
        previousMonth: "readonly",
        nextMonth: "readonly",
        selectDate: "readonly",
        updateCalendar: "readonly",
        openPicker: "readonly",
        updateFooterDate: "readonly",

        // Theme
        toggleTheme: "readonly",

        // Auth
        handleLogout: "readonly",

        // Schedule
        toggleShiftSection: "readonly",
        clearDaySchedule: "readonly",
        renderStaffList: "readonly",
        selectedPeople: "readonly",

        // CommonJS module exports (for optional module pattern)
        module: "readonly",
        exports: "readonly",
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "eqeqeq": ["warn", "always"],
      "prefer-const": "warn",
      "curly": ["warn", "all"],
      "no-eval": "error",
      "no-implied-eval": "error",
    }
  },
  {
    files: ["schedule.js"],
    rules: {
      // schedule.js has test/mock code, be more lenient
      "no-unused-vars": "off",
    }
  },
  {
    files: ["script.js"],
    rules: {
      // script.js is large and has legacy code, be more lenient
      "no-unused-vars": "off",
    }
  }
];
