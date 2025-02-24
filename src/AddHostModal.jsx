import PropTypes from 'prop-types';
import { CssVarsProvider } from '@mui/joy/styles';
import { Modal, Button, FormControl, FormLabel, Input, Stack, DialogTitle, DialogContent, ModalDialog } from '@mui/joy';
import theme from './theme';

const AddHostModal = ({ isHidden, form, setForm, handleAddHost, setIsAddHostHidden }) => {
    return (
        <CssVarsProvider theme={theme}>
            <Modal open={!isHidden} onClose={() => setIsAddHostHidden(true)}>
                <ModalDialog
                    sx={{
                        backgroundColor: theme.palette.neutral[700],
                        borderColor: theme.palette.neutral[100],
                        color: theme.palette.text.primary,
                        padding: 3,
                        borderRadius: 10,
                    }}>
                    <DialogTitle>Add Host</DialogTitle>
                    <DialogContent>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleAddHost();
                            }}
                        >
                            <Stack spacing={2}>
                                <FormControl>
                                    <FormLabel>Host Name</FormLabel>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required={false}
                                        sx={{
                                            backgroundColor: theme.palette.neutral[500],
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Host IP</FormLabel>
                                    <Input
                                        value={form.ip}
                                        onChange={(e) => setForm({ ...form, ip: e.target.value })}
                                        required
                                        sx={{
                                            backgroundColor: theme.palette.neutral[500],
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Host User</FormLabel>
                                    <Input
                                        value={form.user}
                                        onChange={(e) => setForm({ ...form, user: e.target.value })}
                                        required
                                        sx={{
                                            backgroundColor: theme.palette.neutral[500],
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Host Password</FormLabel>
                                    <Input
                                        type="password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required
                                        sx={{
                                            backgroundColor: theme.palette.neutral[500],
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Host Port</FormLabel>
                                    <Input
                                        value={form.port}
                                        onChange={(e) => setForm({ ...form, port: e.target.value })}
                                        min={1}
                                        max={65535}
                                        required
                                        error={form.port < 1 || form.port > 65535 ? "Port must be between 1 and 65535" : ""}
                                        sx={{
                                            backgroundColor: theme.palette.neutral[500],
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <Button
                                    type="submit"
                                    sx={{
                                        backgroundColor: theme.palette.neutral[500],
                                        '&:hover': {
                                            backgroundColor: theme.palette.neutral[900],
                                        },
                                    }}
                                >
                                    Add Host
                                </Button>
                            </Stack>
                        </form>
                    </DialogContent>
                </ModalDialog>
            </Modal>
        </CssVarsProvider>
    );
};

AddHostModal.propTypes = {
    isHidden: PropTypes.bool.isRequired,
    form: PropTypes.shape({
        name: PropTypes.string,
        ip: PropTypes.string.isRequired,
        user: PropTypes.string.isRequired,
        password: PropTypes.string.isRequired,
        port: PropTypes.number.isRequired,
    }).isRequired,
    setForm: PropTypes.func.isRequired,
    handleAddHost: PropTypes.func.isRequired,
    setIsAddHostHidden: PropTypes.func.isRequired,
};

export default AddHostModal;