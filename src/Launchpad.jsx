import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { CssVarsProvider } from '@mui/joy/styles';
import { Button } from '@mui/joy';
import theme from './theme';

function Launchpad({ onClose }) {
    const launchpadRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (launchpadRef.current && !launchpadRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <CssVarsProvider theme={theme}>
            <div
                style={{
                    position: "fixed",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    zIndex: 1000,
                    backdropFilter: "blur(5px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    ref={launchpadRef}
                    style={{
                        width: "75%",
                        height: "75%",
                        backgroundColor: theme.palette.general.tertiary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px",
                        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
                        border: `1px solid ${theme.palette.general.secondary}`,
                        color: theme.palette.text.primary,
                        padding: 3,
                    }}
                >
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Launchpad</h2>
                        <p className="mb-4">W.I.P. Feature</p>
                        <Button
                            type="submit"
                            onClick={onClose}
                            sx={{
                                backgroundColor: theme.palette.general.primary,
                                '&:hover': {
                                    backgroundColor: theme.palette.general.disabled,
                                },
                            }}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </CssVarsProvider>
    );
}

Launchpad.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default Launchpad;