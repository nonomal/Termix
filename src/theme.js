import { extendTheme } from '@mui/joy/styles';

const theme = extendTheme({
    colorSchemes: {
        light: {
            palette: {
                neutral: {
                    50: '#f7f7f7',
                    100: '#e1e1e1',
                    200: '#c4c4c4',
                    300: '#a7a7a7',
                    400: '#8a8a8a',
                    500: '#6e6e6e',
                    600: '#555555',
                    700: '#3d3d3d',
                    800: '#262626',
                    900: '#0f0f0f',
                },
                background: {
                    default: '#212121', // Dark background to contrast white text
                    paper: '#333333', // Slightly lighter paper background for depth
                },
                text: {
                    primary: '#ffffff', // White text for readability
                    secondary: '#b0b0b0', // Light gray for secondary text
                },
                primary: {
                    main: '#ff4081', // Bright pink for the primary accent color
                },
                secondary: {
                    main: '#00bcd4', // A fresh cyan-blue for secondary accents
                },
                error: {
                    main: '#e53935', // Strong red for error
                },
                warning: {
                    main: '#ff9800', // Vibrant yellow-orange for warning
                },
                success: {
                    main: '#4caf50', // Fresh green for success
                },
            },
        },
    },
    typography: {
        fontFamily: 'Arial, sans-serif',
    },
});

export default theme;
