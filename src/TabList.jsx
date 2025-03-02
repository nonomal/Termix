import { Button, ButtonGroup } from "@mui/joy";
import PropTypes from "prop-types";

function TabList({ terminals, activeTab, setActiveTab, closeTab, toggleSplit, splitTabIds, theme }) {
    return (
        <div className="inline-flex items-center h-full px-[0.5rem]">
            {terminals.map((terminal, index) => (
                <div key={terminal.id} className={index < terminals.length - 1 ? "mr-[0.5rem]" : ""}>
                    <ButtonGroup>
                        <Button
                            onClick={() => splitTabIds.length === 0 && setActiveTab(terminal.id)}
                            disabled={splitTabIds.length > 0}
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
                            onClick={() => toggleSplit(terminal.id)}
                            disabled={
                                (splitTabIds.length >= 1 && !splitTabIds.includes(terminal.id)) ||
                                (splitTabIds.length === 0 && terminal.id === activeTab)
                            }
                            sx={{
                                backgroundColor: splitTabIds.includes(terminal.id)
                                    ? theme.palette.neutral[500]
                                    : theme.palette.neutral[700],
                                color: theme.palette.text.primary,
                                "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                borderTopRightRadius: "4px",
                                borderBottomRightRadius: "4px",
                                height: "40px",
                                fontSize: "1rem",
                                opacity: (splitTabIds.length >= 1 && !splitTabIds.includes(terminal.id)) ||
                                (splitTabIds.length === 0 && terminal.id === activeTab) ? 0.5 : 1,
                                cursor: (splitTabIds.length >= 1 && !splitTabIds.includes(terminal.id)) ||
                                (splitTabIds.length === 0 && terminal.id === activeTab)
                                    ? "not-allowed"
                                    : "pointer",
                            }}
                        >
                            /
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
                                fontSize: "1rem",
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
    toggleSplit: PropTypes.func.isRequired,
    splitTabIds: PropTypes.array.isRequired,
    theme: PropTypes.object.isRequired,
};

export default TabList;