import {Button} from "@mui/joy";
import PropTypes from 'prop-types';

function Launchpad({ onClose }) {
    return (
        <div
            style={{
                position: "fixed",
                top: "20%",
                left: "20%",
                width: "60%",
                height: "60%",
                backgroundColor: "gray",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
            }}
        >
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Launchpad</h2>
                <p className="mb-4">This is your all-in-one launchpad panel.</p>
                <Button onClick={onClose}>Close</Button>
            </div>
        </div>
    );
}

Launchpad.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default Launchpad;