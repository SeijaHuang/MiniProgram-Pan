// components/styled-title/index.ts

Component({
    properties: {
        text: {
            type: String,
            value: '',
        },
        isInitial: {
            type: Boolean,
            value: false,
        },
        animation: {
            type: Object,
            value: {},
        },
        customClass: {
            type: String,
            value: '',
        },
    },
});
