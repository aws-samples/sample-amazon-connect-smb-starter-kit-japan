// src/config.js
export async function loadConfig() {
    try {
        const response = await fetch('/config.json');
        if (!response.ok) {
            throw new Error('Failed to load config');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
}
