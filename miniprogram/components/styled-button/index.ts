// components/styled-button/index.ts

Component({
    properties: {
        icon: {
            type: String,
            value: '',
        },
        text: {
            type: String,
            value: '',
            required: true,
        },
        color: {
            type: String,
            value: 'red', // 'red' | 'yellow' | 'blue'
        },
        customClass: {
            type: String,
            value: '',
        },
        buttonStyle: {
            type: String,
            value: '',
        },
    },

    methods: {
        handleTap(): void {
            this.triggerEvent('tap');
        },
    },
});
