import {Button, ButtonGroup} from "@mui/joy";
import PropTypes from "prop-types";

function TabList({ terminals, activeTab, setActiveTab, closeTab, theme }) {
    return (
        <div className="inline-flex items-center h-full px-[0.5rem]">
            {terminals.map((terminal, index) => (
                <div
                    key={terminal.id}
                    className={index < terminals.length - 1 ? "mr-[0.5rem]" : ""}
                >
                    <ButtonGroup>
                        <Button
                            onClick={() => setActiveTab(terminal.id)}
                            sx={{
                                backgroundColor:
                                    terminal.id === activeTab
                                        ? theme.palette.neutral[500]
                                        : theme.palette.neutral[800],
                                color: theme.palette.text.primary,
                                "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                borderTopLeftRadius: "4px",
                                borderBottomLeftRadius: "4px",
                                height: "40px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {terminal.title}
                        </Button>
                        <Button
                            onClick={() => closeTab(terminal.id)}
                            sx={{
                                backgroundColor: theme.palette.neutral[700],
                                color: theme.palette.text.primary,
                                "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                borderTopRightRadius: "4px",
                                borderBottomRightRadius: "4px",
                                height: "40px",
                            }}
                        >
                            ×
                        </Button>
                    </ButtonGroup>
                </div>
            ))}
        </div>
    );
}

TabList.propTypes = {
    terminals: PropTypes.array.isRequired,
    activeTab: PropTypes.any,
    setActiveTab: PropTypes.func.isRequired,
    closeTab: PropTypes.func.isRequired,
    theme: PropTypes.object.isRequired,
};

export default TabList;