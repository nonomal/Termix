import PropTypes from 'prop-types';
import { CssVarsProvider } from '@mui/joy/styles';
import { Modal, Button, FormControl, FormLabel, Input, Stack, DialogTitle, DialogContent, ModalDialog, Select, Option } from '@mui/joy';
import theme from './theme';

const AddHostModal = ({ isHidden, form, setForm, handleAddHost, setIsAddHostHidden }) => {
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.name.endsWith('.rsa') || file.name.endsWith('.key') || file.name.endsWith('.pem') || file.name.endsWith('.der') || file.name.endsWith('.p8') || file.name.endsWith('.ssh')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setForm({ ...form, rsaKey: event.target.result });
                };
                reader.readAsText(file);
            } else {
                alert("Please upload a valid RSA private key file.");
            }
        }
    };

    const isFormValid = () => {
        if (form.authMethod === 'Select Auth') return false;
        if (!form.ip || !form.user || !form.port) return false;
        if (form.authMethod === 'rsaKey' && !form.rsaKey) return false;
        if (form.authMethod === 'password' && !form.password) return false;
        return true;
    };

    return (
        <CssVarsProvider theme={theme}>
            <Modal open={!isHidden} onClose={() => setIsAddHostHidden(true)}>
                <ModalDialog
                    sx={{
                        backgroundColor: theme.palette.general.tertiary,
                        borderColor: theme.palette.general.secondary,
                        color: theme.palette.text.primary,
                        padding: 3,
                        borderRadius: 10,
                        overflowX: 'hidden',
                        overflowY: 'auto',
                    }}>
                    <DialogTitle>Add Host</DialogTitle>
                    <DialogContent>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (isFormValid()) handleAddHost();
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
                                            backgroundColor: theme.palette.general.primary,
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
                                        error={!form.ip ? "Please provide an IP address" : ""}
                                        sx={{
                                            backgroundColor: theme.palette.general.primary,
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
                                        error={form.user ? "" : "Please provide a username"}
                                        sx={{
                                            backgroundColor: theme.palette.general.primary,
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Authentication Method</FormLabel>
                                    <Select
                                        value={form.authMethod}
                                        onChange={(e, newValue) => setForm({ ...form, authMethod: newValue })}
                                        required
                                        displayEmpty
                                        error={!form.authMethod || form.authMethod === 'Select Auth'}
                                        sx={{
                                            backgroundColor: !form.authMethod || form.authMethod === 'Select Auth' ? theme.palette.general.tertiary : theme.palette.general.primary,
                                            color: theme.palette.text.primary,
                                            '&:hover': {
                                                backgroundColor: theme.palette.general.disabled,
                                            },
                                        }}
                                    >
                                        <Option value="" disabled>
                                            Select Auth
                                        </Option>
                                        <Option value="password">Password</Option>
                                        <Option value="rsaKey">RSA Key</Option>
                                    </Select>
                                </FormControl>
                                {form.authMethod === 'password' && (
                                    <FormControl>
                                        <FormLabel>Host Password</FormLabel>
                                        <Input
                                            type="password"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            required
                                            error={form.password ? "" : "Please provide a password"}
                                            sx={{
                                                backgroundColor: theme.palette.general.primary,
                                                color: theme.palette.text.primary,
                                            }}
                                        />
                                    </FormControl>
                                )}
                                {form.authMethod === 'rsaKey' && (
                                    <FormControl>
                                        <FormLabel>RSA Key</FormLabel>
                                        <Input
                                            type="file"
                                            onChange={handleFileChange}
                                            required
                                            error={!form.rsaKey ? "Please upload a valid RSA private key file" : ""}
                                            sx={{
                                                backgroundColor: theme.palette.general.primary,
                                                color: theme.palette.text.primary,
                                                padding: 1,
                                                textAlign: 'center',
                                                width: '100%',
                                                minWidth: 'auto',
                                                minHeight: 'auto',
                                            }}
                                        />
                                    </FormControl>
                                )}
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
                                            backgroundColor: theme.palette.general.primary,
                                            color: theme.palette.text.primary,
                                        }}
                                    />
                                </FormControl>
                                <Button
                                    type="submit"
                                    disabled={!isFormValid()}
                                    sx={{
                                        backgroundColor: theme.palette.general.primary,
                                        '&:hover': {
                                            backgroundColor: theme.palette.general.disabled,
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
        password: PropTypes.string,
        rsaKey: PropTypes.string,
        port: PropTypes.number.isRequired,
        authMethod: PropTypes.string.isRequired,
    }).isRequired,
    setForm: PropTypes.func.isRequired,
    handleAddHost: PropTypes.func.isRequired,
    setIsAddHostHidden: PropTypes.func.isRequired,
};

export default AddHostModal;