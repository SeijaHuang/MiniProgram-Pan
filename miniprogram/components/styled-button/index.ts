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
            value: 'red', // 'red' | 'yellow' | 'blue' | 'grey'
        },
        showShine: {
            type: Boolean,
            value: true,
        },
        disabled: {
            type: Boolean,
            value: false,
        },
        customClass: {
            type: String,
            value: '',
        },
        buttonStyle: {
            type: String,
            value: '',
        },
        openType: {
            type: String,
            value: '',
        },
    },

    methods: {
        handleTap(): void {
            if (this.properties.disabled) {
                return;
            }
            this.triggerEvent('tap');
        },
    },
});
