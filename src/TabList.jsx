import { Button, ButtonGroup } from "@mui/joy";
import PropTypes from "prop-types";

function TabList({ terminals, activeTab, setActiveTab, closeTab, toggleSplit, splitTabIds, theme }) {
    const isSplitScreenActive = splitTabIds.length > 0;

    return (
        <div className="inline-flex items-center h-full px-[0.5rem]">
            {terminals.map((terminal, index) => {
                const isActive = terminal.id === activeTab;
                const isSplit = splitTabIds.includes(terminal.id);

                // Disable split screen button for the active tab (before and after splitting)
                const isSplitButtonDisabled = isActive && !isSplitScreenActive || splitTabIds.length >= 3 && !isSplit;

                return (
                    <div key={terminal.id} className={index < terminals.length - 1 ? "mr-[0.5rem]" : ""}>
                        <ButtonGroup>
                            {/* Set active tab button */}
                            <Button
                                onClick={() => setActiveTab(terminal.id)}
                                disabled={isSplit} // Disabled for split screen tabs
                                sx={{
                                    backgroundColor:
                                        isActive ? theme.palette.neutral[500] : theme.palette.neutral[800],
                                    color: theme.palette.text.primary,
                                    "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                    ":disabled": { backgroundColor: theme.palette.neutral[800] },
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
                            {/* Split screen button */}
                            <Button
                                onClick={() => toggleSplit(terminal.id)}
                                disabled={isSplitButtonDisabled || isActive} // Disable for the active tab (before and after split)
                                sx={{
                                    backgroundColor: isSplit
                                        ? theme.palette.neutral[500]  // Split tabs get color 700
                                        : theme.palette.neutral[700], // Active tab has disabled color
                                    color: theme.palette.text.primary,
                                    ":disabled": { backgroundColor: theme.palette.neutral[800] },
                                    "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                    borderTopRightRadius: "4px",
                                    borderBottomRightRadius: "4px",
                                    height: "40px",
                                    fontSize: "1rem",
                                    cursor: isSplitButtonDisabled ? "not-allowed" : "pointer",
                                }}
                            >
                                /
                            </Button>
                            {/* Close tab button */}
                            <Button
                                onClick={() => closeTab(terminal.id)}
                                disabled={isSplitScreenActive && isActive || isSplit}
                                sx={{
                                    backgroundColor: theme.palette.neutral[700],
                                    color: theme.palette.text.primary,
                                    "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                    ":disabled": { backgroundColor: theme.palette.neutral[800] },
                                    borderTopRightRadius: "4px",
                                    borderBottomRightRadius: "4px",
                                    height: "40px",
                                    fontSize: "1rem",
                                }}
                            >
                                ×
                            </Button>
                        </ButtonGroup>
                    </div>
                );
            })}
        </div>
    );
}

TabList.propTypes = {
    terminals: PropTypes.array.isRequired,
    activeTab: PropTypes.any,
    setActiveTab: PropTypes.func.isRequired,
    closeTab: PropTypes.func.isRequired,
    toggleSplit: PropTypes.func.isRequired,
    splitTabIds: PropTypes.array.isRequired,
    theme: PropTypes.object.isRequired,
};

export default TabList;
