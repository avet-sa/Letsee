// PocketBase Database Client
const pb = new PocketBase('http://127.0.0.1:8090');

// Auto-refresh authentication
pb.autoCancellation(false);

// Storage operations using PocketBase collections
const DB = {
    // Initialize collections
    async init() {
        try {
            // Try to get collections, if they don't exist PocketBase will create them via admin UI
            await pb.collection('people').getList(1, 1);
            await pb.collection('schedules').getList(1, 1);
            await pb.collection('handovers').getList(1, 1);
            await pb.collection('settings').getList(1, 1);
        } catch (error) {
            console.log('Collections will be created via admin UI');
        }
    },

    // People operations
    async getPeople() {
        try {
            const records = await pb.collection('people').getFullList({
                sort: 'created',
            });
            return records.map(r => ({ name: r.name, color: r.color }));
        } catch (error) {
            console.error('Error getting people:', error);
            return [];
        }
    },

    async savePeople(people) {
        try {
            // Delete all existing people
            const existing = await pb.collection('people').getFullList();
            for (const record of existing) {
                await pb.collection('people').delete(record.id);
            }
            // Insert new people
            for (const person of people) {
                await pb.collection('people').create(person);
            }
        } catch (error) {
            console.error('Error saving people:', error);
        }
    },

    // Schedule operations
    async getSchedule() {
        try {
            const records = await pb.collection('schedules').getFullList();
            const schedule = {};
            records.forEach(r => {
                schedule[r.date] = {
                    shift: r.shift,
                    people: r.people
                };
            });
            return schedule;
        } catch (error) {
            console.error('Error getting schedule:', error);
            return {};
        }
    },

    async saveSchedule(schedule) {
        try {
            // Update or create schedule entries
            for (const [date, data] of Object.entries(schedule)) {
                const existing = await pb.collection('schedules').getFirstListItem(`date="${date}"`, {
                    requestKey: null
                }).catch(() => null);

                if (existing) {
                    await pb.collection('schedules').update(existing.id, {
                        shift: data.shift,
                        people: data.people
                    });
                } else {
                    await pb.collection('schedules').create({
                        date: date,
                        shift: data.shift,
                        people: data.people
                    });
                }
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
        }
    },

    // Handover notes operations
    async getHandoverNotes() {
        try {
            const records = await pb.collection('handovers').getFullList();
            const notes = {};
            records.forEach(r => {
                if (!notes[r.date]) {
                    notes[r.date] = [];
                }
                notes[r.date].push({
                    id: r.id,
                    category: r.category,
                    room: r.room,
                    guestName: r.guestName,
                    text: r.text,
                    followup: r.followup,
                    promised: r.promised,
                    promiseText: r.promiseText,
                    attachments: r.attachments || [],
                    timestamp: new Date(r.timestamp).getTime(),
                    completed: r.completed,
                    addedBy: r.addedBy,
                    shift: r.shift,
                    editedAt: r.editedAt ? new Date(r.editedAt).getTime() : null,
                    editedBy: r.editedBy
                });
            });
            return notes;
        } catch (error) {
            console.error('Error getting handover notes:', error);
            return {};
        }
    },

    async saveHandoverNotes(notes) {
        try {
            // Get all existing notes
            const existing = await pb.collection('handovers').getFullList();
            const existingIds = new Set(existing.map(r => r.id));
            const currentIds = new Set();

            // Process all notes
            for (const [date, dateNotes] of Object.entries(notes)) {
                for (const note of dateNotes) {
                    currentIds.add(note.id);
                    
                    const data = {
                        date: date,
                        category: note.category,
                        room: note.room || '',
                        guestName: note.guestName || '',
                        text: note.text,
                        followup: note.followup || false,
                        promised: note.promised || false,
                        promiseText: note.promiseText || '',
                        attachments: note.attachments || [],
                        timestamp: new Date(note.timestamp).toISOString(),
                        completed: note.completed || false,
                        addedBy: note.addedBy || '',
                        shift: note.shift || 'A',
                        editedAt: note.editedAt ? new Date(note.editedAt).toISOString() : '',
                        editedBy: note.editedBy || ''
                    };

                    if (existingIds.has(note.id)) {
                        await pb.collection('handovers').update(note.id, data);
                    } else {
                        await pb.collection('handovers').create({ ...data, id: note.id });
                    }
                }
            }

            // Delete notes that no longer exist
            for (const id of existingIds) {
                if (!currentIds.has(id)) {
                    await pb.collection('handovers').delete(id);
                }
            }
        } catch (error) {
            console.error('Error saving handover notes:', error);
        }
    },

    // Settings operations
    async getSetting(key) {
        try {
            const record = await pb.collection('settings').getFirstListItem(`key="${key}"`, {
                requestKey: null
            });
            return record.value;
        } catch (error) {
            return null;
        }
    },

    async saveSetting(key, value) {
        try {
            const existing = await pb.collection('settings').getFirstListItem(`key="${key}"`, {
                requestKey: null
            }).catch(() => null);

            if (existing) {
                await pb.collection('settings').update(existing.id, { value: value });
            } else {
                await pb.collection('settings').create({ key: key, value: value });
            }
        } catch (error) {
            console.error('Error saving setting:', error);
        }
    }
};
